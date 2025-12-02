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

// Placeholder components for routes not yet implemented
const Placeholder = ({ title }) => (
  <div className="p-10 text-center animate-in fade-in zoom-in duration-300">
    <h2 className="text-2xl font-bold mb-2">{title}</h2>
    <p className="text-muted-foreground">This feature is under construction.</p>
  </div>
);

// We will implement actual pages in the next steps (43, 44, etc.)
// For now, these placeholders verify routing logic works.
import LoginPage from './auth/login-page'; // Anticipating Step 43 creation
import RegisterPage from './auth/register-page'; // Anticipating Step 43 creation

// Fallback plain components if the files don't exist yet in this atomic step context
// (Though typically I would create them in the next step, I'll use placeholders here 
// if the imports fail, but since I am writing the router now, I'll stick to placeholders 
// for the pages I haven't built yet to avoid runtime crash).

export default function AppRouter() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/auth">
        {/* We will build these actual components in Step 43. Using Placeholders for now. */}
        <Route path="login" element={<Placeholder title="Login Page" />} />
        <Route path="register" element={<Placeholder title="Register Page" />} />
      </Route>

      {/* Main App Routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to="/search" replace />} />
        
        {/* Publicly accessible features */}
        <Route path="/search" element={<Placeholder title="Search Listings" />} />
        <Route path="/concierge" element={<Placeholder title="AI Concierge" />} />

        {/* Protected User Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/bookings" element={<Placeholder title="My Bookings" />} />
          <Route path="/profile" element={<Placeholder title="User Profile" />} />
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