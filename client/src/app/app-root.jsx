/**
 * @file client/src/app/app-root.jsx
 * @description Root application component.
 *
 * This component acts as the main shell. In future steps, it will
 * include the global layout (header/footer) and React Router's <Routes>.
 */

import React from 'react';

export default function AppRoot() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-primary">
          Kayak-Like Travel Platform
        </h1>
        <p className="text-muted-foreground">
          Client application initialized with Vite, Tailwind, and React.
        </p>
        <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
          <p className="text-sm font-medium">Status: Setup Complete</p>
        </div>
      </div>
    </div>
  );
}