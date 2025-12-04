/**
 * @file client/src/app/layouts/main-layout.jsx
 * @description Main application layout for public and user-facing routes.
 * * Updates:
 * - Now uses the reusable Navbar component instead of inline header.
 * - This ensures the new KAYAK logo is visible.
 */

import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import Navbar from '@/components/navbar';

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
      {/* Replaced inline header with the Navbar component containing the new Logo */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 container py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built for educational purposes. Synthetic data only.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/about" className="hover:underline">About</Link>
            <Link to="/privacy" className="hover:underline">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}