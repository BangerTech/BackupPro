"use client";

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { 
  FolderIcon, 
  DocumentIcon, 
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  ArrowUpIcon,
  FolderOpenIcon,
  ExclamationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface FilePermissions {
  readable: boolean;
  writable: boolean;
  executable: boolean;
}

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: string;
  permissions?: FilePermissions;
}

interface FileExplorerProps {
  onSelect: (path: string) => void;
  initialPath?: string;
  showFiles?: boolean;
}

// Helper function to normalize paths and prevent double slashes
const normalizePath = (path: string): string => {
  // Replace multiple consecutive slashes with a single slash
  return path.replace(/\/+/g, '/');
};

export default function FileExplorer({ 
  onSelect, 
  initialPath = '/', 
  showFiles = true 
}: FileExplorerProps) {
  const [currentPath, setCurrentPath] = useState(normalizePath(initialPath));
  const [contents, setContents] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>([normalizePath(initialPath)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState<{name: string, path: string}[]>([]);

  useEffect(() => {
    fetchDirectory(currentPath);
  }, [currentPath]);

  useEffect(() => {
    // Generate breadcrumbs from current path
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'Home', path: '/' }];
    
    let currentBuildPath = '';
    parts.forEach(part => {
      // Ensure we don't add double slashes
      currentBuildPath = normalizePath(currentBuildPath + '/' + part);
      crumbs.push({
        name: part,
        path: currentBuildPath
      });
    });
    
    setBreadcrumbs(crumbs);
  }, [currentPath]);

  const fetchDirectory = async (path: string) => {
    try {
      setLoading(true);
      // Normalize the path before sending the request
      const normalizedPath = normalizePath(path);
      const data = await api.get(`/filesystem?path=${encodeURIComponent(normalizedPath)}`);
      setContents(data.contents);
      setCurrentPath(data.currentPath);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  const navigateToDirectory = (path: string) => {
    // Normalize the path
    const normalizedPath = normalizePath(path);
    // Add to history
    const newHistory = [...pathHistory.slice(0, historyIndex + 1), normalizedPath];
    setPathHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentPath(normalizedPath);
  };

  const navigateBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentPath(pathHistory[historyIndex - 1]);
    }
  };

  const navigateForward = () => {
    if (historyIndex < pathHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCurrentPath(pathHistory[historyIndex + 1]);
    }
  };

  const handleSelect = (item: FileItem) => {
    if (item.isDirectory) {
      navigateToDirectory(item.path);
    } else if (showFiles) {
      setSelectedPath(item.path);
      onSelect(item.path);
    }
  };

  const handleSelectCurrentDirectory = () => {
    setSelectedPath(currentPath);
    onSelect(currentPath);
  };

  const formatSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getParentDirectory = (path: string): string => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return '/';
    parts.pop();
    return '/' + parts.join('/');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40 w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
        <div className="flex">
          <ExclamationCircleIcon className="h-5 w-5 text-red-400 dark:text-red-500 mr-2" />
          <div>
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error Loading Directory</h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</div>
            <div className="mt-3">
              <button
                onClick={() => fetchDirectory('/')}
                className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 rounded-md hover:bg-red-200 dark:hover:bg-red-800/60"
              >
                Return to Home Directory
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
      {/* Navigation Bar */}
      <div className="bg-gray-100 dark:bg-gray-800 p-2 flex items-center space-x-2 border-b dark:border-gray-700">
        <div className="flex space-x-1">
          <button
            onClick={navigateBack}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            title="Back"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            onClick={navigateForward}
            disabled={historyIndex >= pathHistory.length - 1}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            title="Forward"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigateToDirectory('/')}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Home"
          >
            <HomeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigateToDirectory(getParentDirectory(currentPath))}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Parent Directory"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
        </div>
        
        {/* Breadcrumbs */}
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 py-1">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-2">
              {breadcrumbs.map((crumb, index) => (
                <li key={crumb.path} className="inline-flex items-center">
                  {index > 0 && (
                    <span className="mx-1 text-gray-400 dark:text-gray-600">/</span>
                  )}
                  <button
                    onClick={() => navigateToDirectory(crumb.path)}
                    className={`inline-flex items-center text-xs hover:text-primary-600 dark:hover:text-primary-400 ${
                      index === breadcrumbs.length - 1 
                        ? 'font-medium text-primary-600 dark:text-primary-400' 
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {index === 0 && <HomeIcon className="h-3 w-3 mr-1" />}
                    {crumb.name}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
        
        <button
          onClick={handleSelectCurrentDirectory}
          className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 transition-colors flex items-center"
        >
          <CheckCircleIcon className="h-4 w-4 mr-1" />
          Select This Directory
        </button>
      </div>

      {/* File List */}
      <div className="bg-white dark:bg-gray-900 max-h-96 overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Modified
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {contents.map((item) => (
              <tr 
                key={item.path}
                onClick={() => handleSelect(item)}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800/70 cursor-pointer transition-colors ${
                  selectedPath === item.path ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                }`}
              >
                <td className="px-6 py-3 whitespace-nowrap">
                  <div className="flex items-center">
                    {item.isDirectory ? (
                      <FolderOpenIcon className="h-5 w-5 text-yellow-500 dark:text-yellow-400 mr-2 flex-shrink-0" />
                    ) : (
                      <DocumentIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2 flex-shrink-0" />
                    )}
                    <span className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-xs">
                      {item.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {item.isDirectory ? '—' : formatSize(item.size)}
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(item.modifiedTime)}
                </td>
              </tr>
            ))}
            {contents.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center">
                    <FolderIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
                    <p>This directory is empty</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 