import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import os from 'os';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Base directory to start browsing from - can be configured via environment variable
// Default to root directory for Linux/Mac or C:\ for Windows
const BASE_DIR = process.env.FILE_EXPLORER_BASE_DIR || 
                (os.platform() === 'win32' ? 'C:\\' : '/');

// Check if the filesystem is mounted as read-only
const isReadOnlyFileSystem = (path: string): boolean => {
  try {
    // Try to create a temporary file to test write access
    const testPath = `${path}/.write_test_${Date.now()}`;
    try {
      fs.writeFileSync(testPath, 'test');
      fs.unlinkSync(testPath);
      return false;
    } catch (err) {
      return true;
    }
  } catch (err) {
    // If we can't even test, assume it's read-only
    return true;
  }
};

// Check once at startup if the base directory is read-only
const isBaseReadOnly = isReadOnlyFileSystem(BASE_DIR);
console.log(`Base directory ${BASE_DIR} is ${isBaseReadOnly ? 'read-only' : 'writable'}`);

const router = Router();

// Get directory contents
router.get('/', async (req, res) => {
  try {
    let requestedPath = req.query.path as string || '/';
    
    // Security check to prevent directory traversal attacks
    if (requestedPath.includes('..')) {
      return res.status(400).json({ error: 'Invalid path: directory traversal not allowed' });
    }
    
    // If the path is just '/', use the base directory
    let fullPath = requestedPath === '/' ? BASE_DIR : path.resolve(BASE_DIR, requestedPath.startsWith('/') ? requestedPath.slice(1) : requestedPath);
    
    // Check if the path exists and is a directory
    try {
      const pathStats = await stat(fullPath);
      if (!pathStats.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }
    } catch (err) {
      return res.status(404).json({ error: `Directory not found: ${fullPath}` });
    }
    
    // Read directory contents
    const files = await readdir(fullPath);
    
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(fullPath, file);
        try {
          const stats = await stat(filePath);
          
          // Create a relative path for the client
          let relativePath;
          if (fullPath === BASE_DIR) {
            relativePath = '/' + file;
          } else {
            // Remove the BASE_DIR from the path to get a relative path
            const relDir = fullPath.substring(BASE_DIR.length);
            relativePath = '/' + path.join(relDir, file).replace(/\\/g, '/');
          }
          
          // For read-only filesystems, don't try to check write permissions
          let permissions = {
            readable: true,
            writable: false,  // Default to false for read-only filesystem
            executable: stats.isDirectory() || (stats.mode & 0o111) !== 0
          };
          
          // Only check write permissions if we're not in a read-only filesystem
          if (!isBaseReadOnly) {
            try {
              permissions.writable = fs.accessSync(filePath, fs.constants.W_OK) === undefined;
            } catch (err) {
              permissions.writable = false;
            }
          }
          
          return {
            name: file,
            path: relativePath,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modifiedTime: stats.mtime,
            permissions
          };
        } catch (err) {
          console.warn(`Cannot access file ${filePath}:`, err);
          // Skip files we can't access
          return null;
        }
      })
    );
    
    // Filter out null entries (files we couldn't access)
    const validFiles = fileStats.filter(file => file !== null);
    
    // Sort directories first, then files alphabetically
    validFiles.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    res.json({
      currentPath: requestedPath,
      fullPath: fullPath,
      contents: validFiles,
      isRoot: fullPath === BASE_DIR,
      isReadOnly: isBaseReadOnly
    });
  } catch (error: unknown) {
    console.error('Error reading directory:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      error: 'Failed to read directory',
      message: errorMessage
    });
  }
});

export default router; 