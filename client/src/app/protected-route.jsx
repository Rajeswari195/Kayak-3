/**
 * @file client/src/app/protected-route.jsx
 * @description Wrapper component for routes that require authentication.
 * * Logic:
 * - If loading, show spinner.
 * - If no user, redirect to /auth/login.
 * - If user exists, render Outlet or children.
 */

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import LoadingSpinner from '@/components/loading-spinner';

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner centered />;
  }

  if (!user) {
    // Redirect to login page, but save the current location they were trying to go to
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}