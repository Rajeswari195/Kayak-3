/**
 * @file client/src/features/auth/components/login-form.jsx
 * @description User login form component.
 * * Updates:
 * - Intelligent redirect: Admins go to /admin, Users go to /search (or previous page).
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import StatusBanner from '@/components/status-banner';
import LoadingSpinner from '@/components/loading-spinner';

export default function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Did the user try to access a protected page?
  const from = location.state?.from?.pathname;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { user } = await login(formData);
      
      if (from) {
        // If they were redirected to login, send them back where they wanted to go
        navigate(from, { replace: true });
      } else {
        // Default Redirects based on Role
        const isAdmin = user.role === 'ADMIN' || user.isAdmin === true;
        if (isAdmin) {
          navigate('/admin', { replace: true });
        } else {
          navigate('/search', { replace: true });
        }
      }

    } catch (err) {
      console.error("Login error:", err);
      const code = err.code || 'login_failed';
      const message = err.message || 'Failed to log in. Please check your credentials.';
      setError({ code, message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              name="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isSubmitting}
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          
          {error && (
            <StatusBanner 
              status="error" 
              message={error.message} 
              code={error.code} 
            />
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoadingSpinner className="mr-2 h-4 w-4" />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </div>
      </form>
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or
          </span>
        </div>
      </div>
      
      <div className="text-center text-sm">
        Don't have an account?{" "}
        <Link to="/auth/register" className="underline underline-offset-4 hover:text-primary">
          Sign up
        </Link>
      </div>
    </div>
  );
}