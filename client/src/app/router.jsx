/**
 * @file client/src/app/router.jsx
 * @description Central routing configuration.
 * * Structure:
 * - / (Root): Redirects to Search.
 * - /auth/*: Public auth routes.
 * - /admin/*: Protected Admin routes (AdminLayout).
 * - /bookings, /profile: Protected User routes (MainLayout).
 * - /search, /concierge: Public/Mixed routes (MainLayout).
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import MainLayout from './layouts/main-layout';
import AdminLayout from './layouts/admin-layout';
import ProtectedRoute from './protected-route';
import AdminRoute from './admin-route';

// Auth Pages
import LoginPage from './auth/login-page';
import RegisterPage from './auth/register-page';

// User Pages
import ProfilePage from './profile/profile-page';
import SearchPage from './search/search-page';

// Admin Pages
import AdminListingsPage from './admin/admin-listings-page';
import AdminUsersPage from './admin/admin-users-page';
import AdminBillingPage from './admin/admin-billing-page';

// Placeholder components for routes not yet implemented
const Placeholder = ({ title }) => (
  <div className="p-10 text-center animate-in fade-in zoom-in duration-300">
    <h2 className="text-2xl font-bold mb-2">{title}</h2>
    <p className="text-muted-foreground">This feature is under construction.</p>
  </div>
);

export default function AppRouter() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/auth">
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>

      {/* Main App Routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to="/search" replace />} />
        
        {/* Publicly accessible features */}
        <Route path="/search" element={<SearchPage />} />
        <Route path="/concierge" element={<Placeholder title="AI Concierge" />} />

        {/* Protected User Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/bookings" element={<ProfilePage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Protected Admin Routes */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/listings" replace />} />
          <Route path="listings" element={<AdminListingsPage />} />
          
          {/* Updated to use real Admin pages */}
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="billing" element={<AdminBillingPage />} />
          
          <Route path="analytics" element={<Placeholder title="Analytics Dashboard" />} />
        </Route>
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={
        <div className="h-screen flex items-center justify-center flex-col gap-4">
           <h1 className="text-4xl font-bold">404</h1>
           <p className="text-muted-foreground">Page not found</p>
           <a href="/" className="text-primary hover:underline">Go Home</a>
        </div>
      } />
    </Routes>
  );
}