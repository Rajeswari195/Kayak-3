/**
 * @file client/src/app/auth/register-page.jsx
 * @description Registration page layout.
 */

import React from 'react';
import RegisterForm from '@/features/auth/components/register-form';
import { Plane } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RegisterPage() {
  return (
    <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      {/* Left Column: Branding/Hero */}
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-secondary" /> 
        <div className="relative z-20 flex items-center text-lg font-medium text-secondary-foreground">
          <Plane className="mr-2 h-6 w-6" />
          KayakClone
        </div>
        <div className="relative z-20 mt-auto text-secondary-foreground">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;Join millions of travelers finding the best deals on flights, hotels, and rental cars.&rdquo;
            </p>
          </blockquote>
        </div>
      </div>
      
      {/* Right Column: Form */}
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px] md:w-[450px]">
          <div className="flex flex-col space-y-2 text-center">
             <h1 className="text-2xl font-semibold tracking-tight">
               Create an account
             </h1>
             <p className="text-sm text-muted-foreground">
               Enter your details below to create your account
             </p>
          </div>
          
          <RegisterForm />
          
          <p className="px-8 text-center text-sm text-muted-foreground">
             By clicking continue, you agree to our{" "}
             <Link to="/terms" className="underline underline-offset-4 hover:text-primary">
               Terms of Service
             </Link>
             .
          </p>
        </div>
      </div>
    </div>
  );
}