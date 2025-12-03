/**
 * @file client/src/app/layouts/main-layout.jsx
 * @description Main application layout for public and user-facing routes.
 * * Features:
 * - Responsive Navbar with logo and navigation links.
 * - Footer with copyright info.
 * - Renders child routes via <Outlet />.
 * - Connects to real AuthContext to toggle Log in / Profile links.
 */

import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Plane, User, LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/use-auth';
import { Button } from '@/ui/button';
import { useClickstream } from '@/features/analytics/use-clickstream';

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  useClickstream();

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'ADMIN' || user?.isAdmin === true;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center space-x-2 font-bold text-xl text-primary">
              <Plane className="h-6 w-6" />
              <span>KayakClone</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <Link 
                to="/search" 
                className={`transition-colors hover:text-foreground ${location.pathname.startsWith('/search') ? 'text-foreground' : ''}`}
              >
                Search
              </Link>
              <Link 
                to="/concierge" 
                className={`transition-colors hover:text-foreground ${location.pathname.startsWith('/concierge') ? 'text-foreground' : ''}`}
              >
                AI Concierge
              </Link>
              {isAuthenticated && (
                <Link 
                  to="/bookings" 
                  className={`transition-colors hover:text-foreground ${location.pathname.startsWith('/bookings') ? 'text-foreground' : ''}`}
                >
                  My Bookings
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin && (
              <Link 
                to="/admin" 
                className="hidden md:inline-flex text-sm font-medium text-destructive transition-colors hover:text-destructive/80"
              >
                Admin Dashboard
              </Link>
            )}
            
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                   <Link to="/profile">
                     <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors" title="Profile">
                        {user.profileImageUrl ? (
                          <img src={user.profileImageUrl} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                     </div>
                   </Link>
                   <Button variant="ghost" size="sm" onClick={handleLogout} title="Log out">
                     <LogOut className="h-4 w-4" />
                   </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                   <Link to="/auth/login" className="font-medium hover:underline">Log in</Link>
                   <span className="text-muted-foreground">/</span>
                   <Link to="/auth/register" className="font-medium hover:underline">Sign up</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

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