/**
 * @file client/src/app/layouts/admin-layout.jsx
 * @description Layout for the Admin Dashboard.
 *
 * Features:
 * - Sidebar navigation for admin modules (Listings, Users, Analytics).
 * - Distinct styling to separate from user-facing app.
 */

import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Map, 
  BarChart3, 
  LogOut 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminLayout() {
  const location = useLocation();

  const navItems = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/listings", label: "Listings", icon: Map },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/billing", label: "Billing", icon: CreditCard },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex bg-muted/40 font-sans text-foreground">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 w-64 border-r bg-background hidden md:flex flex-col">
        <div className="flex h-14 items-center border-b px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="text-destructive">Kayak Admin</span>
          </Link>
        </div>
        
        <div className="flex-1 overflow-auto py-4">
          <nav className="grid items-start px-4 text-sm font-medium gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || 
                               (item.href !== "/admin" && location.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-foreground",
                    isActive 
                      ? "bg-muted text-foreground" 
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t p-4">
          <Link 
            to="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Exit to App
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:pl-64 flex flex-col">
        <header className="flex h-14 lg:h-[60px] items-center gap-4 border-b bg-muted/40 px-6">
          <div className="w-full flex-1">
             <h1 className="text-lg font-semibold">Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
             {/* Admin User Profile or Actions could go here */}
             <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                AD
             </div>
          </div>
        </header>
        
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}