/**
 * @file client/src/features/auth/auth-context.jsx
 * @description React Context Provider for global authentication state.
 * * Features:
 * - Manages `user` and `isLoading` state.
 * - Hydrates user from LocalStorage on mount.
 * - Exposes login, register, and logout functions that handle API calls and storage.
 * * @dependencies
 * - client/src/features/auth/api.js: For backend auth calls.
 * - client/src/lib/auth-storage.js: For persisting tokens/user.
 */

import React, { createContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import {
  loginWithEmailAndPassword,
  registerUser,
  logoutUser,
  getProfile
} from './api';
import {
  getToken,
  setToken,
  clearAuth,
  getStoredUser,
  setStoredUser
} from '@/lib/auth-storage';

// Initial State
const initialState = {
  user: null,
  isLoading: true,
  error: null,
};

// Action Types
const ACTIONS = {
  INITIALIZE: 'INITIALIZE',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Reducer
function authReducer(state, action) {
  switch (action.type) {
    case ACTIONS.INITIALIZE:
      return {
        ...state,
        user: action.payload.user,
        isLoading: false,
      };
    case ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        error: null,
      };
    case ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        error: null,
      };
    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload.error,
      };
    case ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Hydrate state from storage on mount
  useEffect(() => {
    async function initializeAuth() {
      const token = getToken();
      const storedUser = getStoredUser();

      if (token && storedUser) {
        // Optimistically set user from storage
        dispatch({
          type: ACTIONS.INITIALIZE,
          payload: { user: storedUser }
        });

        // Optionally verify with backend in background to ensure token is still valid
        try {
          // If token is invalid, the interceptor/apiClient might throw
          // In a real app, we might want to refresh user details here
          // const { user } = await getProfile();
          // dispatch({ type: ACTIONS.LOGIN_SUCCESS, payload: { user } });
        } catch (error) {
          // Token expired or invalid
          console.warn("Stored session invalid:", error);
          clearAuth();
          dispatch({ type: ACTIONS.LOGOUT });
        }
      } else {
        dispatch({
          type: ACTIONS.INITIALIZE,
          payload: { user: null }
        });
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

      dispatch({
        type: ACTIONS.LOGIN_SUCCESS,
        payload: { user }
      });
      return { success: true };
    } catch (error) {
      const message = error.message || 'Login failed';
      dispatch({ type: ACTIONS.SET_ERROR, payload: { error: message } });
      throw error; // Re-throw so components can handle specific error codes
    }
  }, []);

  const register = useCallback(async (payload) => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
    try {
      const response = await registerUser(payload);

      // Auto-login after successful registration
      if (payload.email && payload.password) {
        const loginResponse = await loginWithEmailAndPassword({
          email: payload.email,
          password: payload.password
        });

        const { accessToken, user } = loginResponse;
        setToken(accessToken);
        setStoredUser(user);

        dispatch({
          type: ACTIONS.LOGIN_SUCCESS,
          payload: { user }
        });
      } else if (response.accessToken) {
        // Fallback if backend returns token directly
        setToken(response.accessToken);
        setStoredUser(response.user);
        dispatch({
          type: ACTIONS.LOGIN_SUCCESS,
          payload: { user: response.user }
        });
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
      await logoutUser(); // Optional backend call
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