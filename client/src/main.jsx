/**
 * @file client/src/main.jsx
 * @description Client entry point.
 * * Features:
 * - Renders AppRoot into DOM.
 * - Configures React Query ClientProvider.
 * - Wraps app in BrowserRouter and AuthProvider.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppRoot from './app/app-root';
import { AuthProvider } from '@/features/auth/auth-context';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoot />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);