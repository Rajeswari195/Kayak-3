/**
 * @file client/src/app/auth/login-page.jsx
 * @description Login page layout.
 */

import React from 'react';
import LoginForm from '@/features/auth/components/login-form';
import { Plane } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LoginPage() {
  return (
    <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      {/* Left Column: Branding/Hero (Hidden on mobile) */}
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-primary" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <Plane className="mr-2 h-6 w-6" />
          KayakClone
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;The best way to predict the future is to create it. Also, booking cheap flights helps.&rdquo;
            </p>
            <footer className="text-sm">Sofia Davis</footer>
          </blockquote>
        </div>
      </div>
      
      {/* Right Column: Form */}
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
             <h1 className="text-2xl font-semibold tracking-tight">
               Welcome back
             </h1>
             <p className="text-sm text-muted-foreground">
               Enter your credentials to access your account
             </p>
          </div>
          
          <LoginForm />
          
          <p className="px-8 text-center text-sm text-muted-foreground">
             By clicking continue, you agree to our{" "}
             <Link to="/terms" className="underline underline-offset-4 hover:text-primary">
               Terms of Service
             </Link>{" "}
             and{" "}
             <Link to="/privacy" className="underline underline-offset-4 hover:text-primary">
               Privacy Policy
             </Link>
             .
          </p>
        </div>
      </div>
    </div>
  );
}