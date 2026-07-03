/**
 * useRoute.js
 *
 * Runs while a navigation session is active.
 * Every PING_INTERVAL_MS it calls POST /route/{id}/deviation with the current
 * GPS position and updates Redux with the result.
 *
 * Escalation (mirrors backend logic for instant UI feedback):
 *   level 0 → on track, no banner
 *   level 1 → amber banner "You may be off track"
 *   level 2 → red banner + caregiver WebSocket notification sent
 *
 * Usage:
 *   Call unconditionally in Navigation.jsx — it no-ops when there's no active route.
 */

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { navigationApi } from '../utils/navigationApi';
import { applyDeviationResult, cancelRoute, clearRoute } from '../store/navigationSlice';

const PING_INTERVAL_MS = 5_000;   // ping every 5 seconds while navigating

export function useRoute() {
  const dispatch   = useDispatch();
  const activeRoute    = useSelector(s => s.navigation.activeRoute);
  const currentPosition = useSelector(s => s.navigation.currentPosition);
  const arrived         = useSelector(s => s.navigation.arrived);

  // Keep refs so the interval closure always sees the latest values.
  const routeRef    = useRef(activeRoute);
  const positionRef = useRef(currentPosition);
  useEffect(() => { routeRef.current    = activeRoute;     }, [activeRoute]);
  useEffect(() => { positionRef.current = currentPosition; }, [currentPosition]);

  useEffect(() => {
    if (!activeRoute) return;   // no-op when idle
    if (arrived)      return;   // stop pinging once arrived

    const interval = setInterval(async () => {
      const route = routeRef.current;
      const pos   = positionRef.current;
      if (!route || !pos) return;

      try {
        const result = await navigationApi.pingDeviation(route.id, {
          latitude:  pos.latitude,
          longitude: pos.longitude,
        });

        dispatch(applyDeviationResult(result));

        // If arrived, clear the route from Redux after a short delay
        // so the "You have arrived" UI has time to show.
        if (result.arrived) {
          setTimeout(() => dispatch(clearRoute()), 4_000);
        }

      } catch (err) {
        // Network hiccup — silently skip this ping.
        console.warn('[useRoute] deviation ping failed:', err);
      }
    }, PING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeRoute?.id, arrived, dispatch]);   // restart if route changes
}