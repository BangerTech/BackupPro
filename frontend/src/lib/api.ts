// API configuration
const API_URL = '/api';

// Auth token for API requests
let authToken: string | null = null;

// Set auth token for API requests
export const setAuthToken = (token: string | null) => {
  authToken = token;
};

// Remove any double slashes from the path
const cleanPath = (path: string) => {
  // Remove /api prefix if present as we add it in API_URL
  path = path.startsWith('/api/') ? path.substring(4) : path;
  // Ensure path starts with /
  return path.startsWith('/') ? path : `/${path}`;
};

export const api = {
  async get(path: string) {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      
      // Add auth token if available
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(`${API_URL}${cleanPath(path)}`, {
        headers,
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error('API GET error:', error);
      throw error;
    }
  },

  async post(path: string, data: any) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Add auth token if available
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(`${API_URL}${cleanPath(path)}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error('API POST error:', error);
      throw error;
    }
  },

  async put(path: string, data: any) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Add auth token if available
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(`${API_URL}${cleanPath(path)}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error('API PUT error:', error);
      throw error;
    }
  },

  async delete(path: string) {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      
      // Add auth token if available
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(`${API_URL}${cleanPath(path)}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // Check if the response is 204 No Content, return empty object instead of parsing JSON
      if (response.status === 204) {
        return {};
      }
      return response.json();
    } catch (error) {
      console.error('API DELETE error:', error);
      throw error;
    }
  },
}; 