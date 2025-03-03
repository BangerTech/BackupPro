// API configuration
const API_URL = '/api';

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
      const response = await fetch(`${API_URL}${cleanPath(path)}`, {
        headers: {
          'Accept': 'application/json'
        },
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
      const response = await fetch(`${API_URL}${cleanPath(path)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
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
      const response = await fetch(`${API_URL}${cleanPath(path)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
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
      const response = await fetch(`${API_URL}${cleanPath(path)}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error('API DELETE error:', error);
      throw error;
    }
  },
}; 