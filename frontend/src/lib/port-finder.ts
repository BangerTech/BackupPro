// Dynamic imports for browser-only modules
let net: any = null;

// Ensure this code only runs in the browser
const isBrowser = typeof window !== 'undefined';

// Dynamically import net in browser environment
if (isBrowser) {
  import('net').then(module => {
    net = module;
  }).catch(err => {
    console.error('Failed to load net module:', err);
  });
}

/**
 * Checks if a port is available
 * @param port Port to check
 * @returns Promise that resolves to true if port is available, false otherwise
 */
export function isPortAvailable(port: number): Promise<boolean> {
  // Ensure we're in a browser environment
  if (!isBrowser || !net) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

/**
 * Finds an available port in the given range
 * @param startPort Start of port range
 * @param endPort End of port range
 * @returns Promise that resolves to an available port
 */
export async function getAvailablePort(startPort: number, endPort: number): Promise<number> {
  // Ensure we're in a browser environment
  if (!isBrowser || !net) {
    return startPort;
  }

  for (let port = startPort; port <= endPort; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  
  throw new Error(`No available port found in range ${startPort}-${endPort}`);
} 