/**
 * @file client/src/features/auth/use-auth.js
 * @description Custom hook to consume AuthContext.
 */

import { useContext } from 'react';
import { AuthContext } from './auth-context';

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}