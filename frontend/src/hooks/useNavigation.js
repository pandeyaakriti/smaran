/**
 * useNavigation
 *
 * Encapsulates everything location-related for Phase 1:
 *   1. Watches the browser's Geolocation API and keeps Redux in sync.
 *   2. Detects proximity to saved locations and fires recordVisit thunk.
 *   3. Exposes helpers the map and UI need.
 *
 * Usage:
 *   const { currentPosition, gpsError, nearbyLocation } = useNavigation();
 */

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  fetchLocations,
  recordVisit,
  setCurrentPosition,
  setGpsError,
} from '../store/navigationSlice';

// How close (metres) the user must be to trigger a "nearby" detection.
const PROXIMITY_THRESHOLD_M = 100;

// Minimum milliseconds between visit recordings for the same location
// (avoids spamming the backend while the user stands still).
const VISIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// ── Haversine distance (metres) ─────────────────────────────────────────────
function haversineMetres(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useNavigation() {
  const dispatch = useDispatch();
  const { currentPosition, gpsError, locations, locationsStatus } = useSelector(
    (s) => s.navigation
  );

  // Track the last time a visit was recorded per location id.
  const lastVisitRef = useRef({}); // { [locationId]: timestamp }

  // The closest saved location within PROXIMITY_THRESHOLD_M (or null).
  const [nearbyLocation, setNearbyLocation] = useState(null);

  // ── Load saved locations on mount ──────────────────────────────────────
  useEffect(() => {
    if (locationsStatus === 'idle') {
      dispatch(fetchLocations());
    }
  }, [dispatch, locationsStatus]);

  // ── Start GPS watch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      dispatch(setGpsError('Geolocation is not supported by this browser.'));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        dispatch(
          setCurrentPosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,  // metres
            timestamp: pos.timestamp,
          })
        );
      },
      (err) => {
        const messages = {
          1: 'Location access was denied. Please enable it in your browser settings.',
          2: 'Your location could not be determined.',
          3: 'Location request timed out.',
        };
        dispatch(setGpsError(messages[err.code] ?? 'Unknown location error.'));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,   // accept a cached position up to 5 s old
        timeout: 15_000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [dispatch]);

  // ── Proximity detection ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentPosition || locations.length === 0) return;

    const { latitude, longitude } = currentPosition;
    let closest = null;
    let closestDist = Infinity;

    for (const loc of locations) {
      const dist = haversineMetres(latitude, longitude, loc.latitude, loc.longitude);
      if (dist < PROXIMITY_THRESHOLD_M && dist < closestDist) {
        closest = loc;
        closestDist = dist;
      }
    }

    setNearbyLocation(closest);

    // Record a visit if not on cooldown.
    if (closest) {
      const lastTime = lastVisitRef.current[closest.id] ?? 0;
      if (Date.now() - lastTime > VISIT_COOLDOWN_MS) {
        lastVisitRef.current[closest.id] = Date.now();
        dispatch(
          recordVisit({
            saved_location_id: closest.id,
            latitude,
            longitude,
          })
        );
      }
    }
  }, [currentPosition, locations, dispatch]);

  return {
    currentPosition,
    gpsError,
    locations,
    locationsStatus,
    nearbyLocation,
    /** Utility exposed to components that need a distance calc. */
    distanceTo: (lat, lon) => {
      if (!currentPosition) return null;
      return haversineMetres(
        currentPosition.latitude,
        currentPosition.longitude,
        lat,
        lon
      );
    },
  };
}