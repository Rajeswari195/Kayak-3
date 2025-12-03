/**
 * @file client/src/features/analytics/use-clickstream.js
 * @description Custom hook for automatic page view tracking and manual event logging.
 * * Features:
 * - Generates/Retrieves a persistent Session ID.
 * - Listens to React Router location changes to log PAGE_VIEW.
 * - Exposes a `track` function for custom events.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from './clickstream-api';

const SESSION_STORAGE_KEY = 'kayak_session_id';

/**
 * Helper to get or create a session ID.
 * Keeps anonymous users identifiable across refreshes.
 */
function getOrCreateSessionId() {
  if (typeof window === 'undefined') return null;
  
  let sessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = `sess_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

export function useClickstream() {
  const location = useLocation();
  const lastTrackedPath = useRef(null);
  const sessionId = useRef(getOrCreateSessionId());

  /**
   * Manual tracking function exposed to components.
   * @param {string} eventType - e.g., 'CLICK', 'SEARCH_INIT'
   * @param {Object} [metadata] - Additional context
   */
  const track = useCallback((eventType, metadata = {}) => {
    trackEvent({
      eventType,
      path: window.location.pathname,
      sessionId: sessionId.current,
      metadata
    });
  }, []);

  /**
   * Automatic Page View Tracking
   * Triggered whenever location.pathname changes.
   */
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    // Prevent duplicate logging (React StrictMode or quick re-renders)
    if (lastTrackedPath.current === currentPath) {
      return;
    }

    lastTrackedPath.current = currentPath;

    trackEvent({
      eventType: 'PAGE_VIEW',
      path: currentPath,
      sessionId: sessionId.current,
      metadata: {
        referrer: document.referrer || null,
        title: document.title
      }
    });
  }, [location]);

  return { track, sessionId: sessionId.current };
}