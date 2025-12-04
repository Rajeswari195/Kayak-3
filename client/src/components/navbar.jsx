/**
 * @file client/src/components/navbar.jsx
 * @description Main application navigation bar.
 * * Updates:
 * - Implemented "Initials Avatar" for the user profile button to ensure visibility.
 * - Added distinct styling to the profile trigger.
 */
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import { Button } from '@/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';

// The specific Kayak orange color
const KAYAK_ORANGE = 'bg-[rgb(255,105,15)]';

export default function Navbar() {
  const { user, logout } = useAuth();
  const isAuthenticated = !!user;
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isAdmin = user?.role === 'ADMIN';
  const isOnAdminPage = location.pathname.startsWith('/admin');

  // Calculate initials for the avatar
  const getInitials = () => {
    if (!user) return 'U';
    const first = user.firstName?.[0] || '';
    const last = user.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* LOGO SECTION */}
        <Link to="/" className="flex items-center gap-[2px] hover:opacity-90 transition-opacity" aria-label="Kayak Home">
          {['K', 'A', 'Y', 'A', 'K'].map((letter, i) => (
            <div
              key={i}
              className={`flex h-8 w-8 items-center justify-center ${KAYAK_ORANGE} text-lg font-extrabold text-white select-none rounded-sm`}
            >
              {letter}
            </div>
          ))}
        </Link>

        <nav className="flex items-center gap-4 lg:gap-6">
          {!isOnAdminPage && (
             <>
               <Link to="/search" className="text-sm font-medium hover:underline underline-offset-4 hidden md:block">
                 Search
               </Link>
               <Link to="/ai-concierge" className="text-sm font-medium hover:underline underline-offset-4 hidden md:block">
                 AI Concierge
               </Link>
                {isAuthenticated && (
                  <Link to="/bookings" className="text-sm font-medium hover:underline underline-offset-4 hidden md:block">
                    My Bookings
                  </Link>
                )}
             </>
          )}

          <div className="flex items-center gap-2">
            {isAdmin && !isOnAdminPage && (
              <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
                <Link to="/admin">Admin Dashboard</Link>
              </Button>
            )}
             {isAdmin && isOnAdminPage && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/">Exit Admin</Link>
              </Button>
            )}

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {/* UPDATED PROFILE BUTTON: Uses Initials + Background Color */}
                  <Button 
                    variant="ghost" 
                    className="relative h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/20 flex items-center justify-center overflow-hidden"
                  >
                    <span className="text-xs font-bold text-primary">
                      {getInitials()}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                     <Link to="/bookings">
                       <Settings className="mr-2 h-4 w-4" />
                       <span>My Bookings</span>
                     </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className="md:hidden">
                        <Link to="/admin">Admin Dashboard</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/auth/login">Log in</Link>
                </Button>
                 <Button size="sm" asChild>
                  <Link to="/auth/register">Register</Link>
                </Button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}