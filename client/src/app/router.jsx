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

// User Pages (Step 44)
import ProfilePage from './profile/profile-page';

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
        <Route path="/search" element={<Placeholder title="Search Listings" />} />
        <Route path="/concierge" element={<Placeholder title="AI Concierge" />} />

        {/* Protected User Routes */}
        <Route element={<ProtectedRoute />}>
          {/* Note: /bookings could be a standalone page, but for now we link it to Profile or a dedicated bookings page. 
              The spec asked for "View bookings" separately but Profile aggregates them well. 
              Let's keep /bookings as a route, maybe redirecting to profile or having its own view. 
              For now, we will use ProfilePage for /bookings too or just a placeholder if it's distinct.
              Spec: "View bookings... Past/Current/Future". ProfilePage has this.
              Let's map /bookings to ProfilePage for now or a dedicated wrapper. */}
          <Route path="/bookings" element={<ProfilePage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Protected Admin Routes */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Placeholder title="Admin Overview" />} />
          <Route path="listings" element={<Placeholder title="Manage Listings" />} />
          <Route path="users" element={<Placeholder title="Manage Users" />} />
          <Route path="billing" element={<Placeholder title="Billing Reports" />} />
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