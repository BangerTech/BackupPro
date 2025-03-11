'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken } from './api';

// Define user type
interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  isAdmin: boolean;
}

// Define auth context type
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (code: string, redirectUri: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      
      // Set auth token for API requests
      setAuthToken(storedToken);
    }
    
    setIsLoading(false);
  }, []);

  // Login function
  const login = async (code: string, redirectUri: string) => {
    try {
      setIsLoading(true);
      
      const response = await api.post('/api/oauth/google', {
        code,
        redirectUri
      });
      
      const { user, token } = response.data;
      
      // Save to state
      setUser(user);
      setToken(token);
      
      // Save to local storage
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      
      // Set auth token for API requests
      setAuthToken(token);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    // Clear state
    setUser(null);
    setToken(null);
    
    // Clear local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    
    // Clear auth token
    setAuthToken(null);
  };

  // Check if user is authenticated
  const checkAuth = async (): Promise<boolean> => {
    if (!token) return false;
    
    try {
      // You can add a token validation endpoint if needed
      return true;
    } catch (error) {
      console.error('Auth check error:', error);
      logout();
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        checkAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
} 