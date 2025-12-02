/**
 * @file client/src/app/admin-route.jsx
 * @description Wrapper for routes that require ADMIN role.
 * * Logic:
 * - If loading, show spinner.
 * - If no user, redirect to login.
 * - If user role != 'ADMIN', redirect to home (unauthorized).
 */

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import LoadingSpinner from '@/components/loading-spinner';

export default function AdminRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner centered />;
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Check specific role or admin flag
  // Backend returns role: "ADMIN" or "USER" (or isAdmin boolean)
  const isAdmin = user.role === 'ADMIN' || user.isAdmin === true;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}