/**
 * @file client/src/app/app-root.jsx
 * @description Root application component.
 *
 * This component acts as the main shell. It delegates the rendering
 * to AppRouter, which handles all the route definitions.
 */

import React from 'react';
import AppRouter from './router';

export default function AppRoot() {
  return (
    <AppRouter />
  );
}