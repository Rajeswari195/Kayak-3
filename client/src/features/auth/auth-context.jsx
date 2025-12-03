/**
 * @file client/src/features/auth/auth-context.jsx
 * @description React Context Provider for global authentication state.
 * * Updates:
 * - login() now returns the full `user` object to allow role-based redirects.
 */

import React, { createContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import { 
  loginWithEmailAndPassword, 
  registerUser, 
  logoutUser 
} from './api';
import { 
  getToken, 
  setToken, 
  clearAuth, 
  getStoredUser, 
  setStoredUser 
} from '@/lib/auth-storage';

const initialState = {
  user: null,
  isLoading: true,
  error: null,
};

const ACTIONS = {
  INITIALIZE: 'INITIALIZE',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

function authReducer(state, action) {
  switch (action.type) {
    case ACTIONS.INITIALIZE:
      return { ...state, user: action.payload.user, isLoading: false };
    case ACTIONS.LOGIN_SUCCESS:
      return { ...state, user: action.payload.user, error: null };
    case ACTIONS.LOGOUT:
      return { ...state, user: null, error: null };
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload.error };
    case ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    default:
      return state;
  }
}

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    async function initializeAuth() {
      const token = getToken();
      const storedUser = getStoredUser();

      if (token && storedUser) {
        dispatch({ type: ACTIONS.INITIALIZE, payload: { user: storedUser } });
      } else {
        dispatch({ type: ACTIONS.INITIALIZE, payload: { user: null } });
      }
    }
    initializeAuth();
  }, []);

  const login = useCallback(async (credentials) => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
    try {
      const response = await loginWithEmailAndPassword(credentials);
      const { accessToken, user } = response;
      
      setToken(accessToken);
      setStoredUser(user);
      
      dispatch({ type: ACTIONS.LOGIN_SUCCESS, payload: { user } });
      
      // RETURN THE USER OBJECT HERE
      return { success: true, user }; 
    } catch (error) {
      const message = error.message || 'Login failed';
      dispatch({ type: ACTIONS.SET_ERROR, payload: { error: message } });
      throw error;
    }
  }, []);

  const register = useCallback(async (payload) => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
    try {
      const response = await registerUser(payload);
      if (response.accessToken) {
        setToken(response.accessToken);
        setStoredUser(response.user);
        dispatch({ type: ACTIONS.LOGIN_SUCCESS, payload: { user: response.user } });
      }
      return response;
    } catch (error) {
      const message = error.message || 'Registration failed';
      dispatch({ type: ACTIONS.SET_ERROR, payload: { error: message } });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.warn("Logout API call failed", err);
    } finally {
      clearAuth();
      dispatch({ type: ACTIONS.LOGOUT });
    }
  }, []);

  const value = useMemo(() => ({
    ...state,
    login,
    register,
    logout
  }), [state, login, register, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}