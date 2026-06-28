/**
 * navigationApi.js — Phase 1 + Phase 2
 *
 * Same shape as personApi / memoryApi:
 * uses the shared `api` axios instance with Supabase JWT interceptor.
 */

import api from './api';

const BASE = '/navigation';

export const navigationApi = {
  // ── Saved locations ───────────────────────────────────────────────────────

  listLocations:  ()           => api.get(`${BASE}/locations`).then(r => r.data),
  createLocation: (payload)    => api.post(`${BASE}/locations`, payload).then(r => r.data),
  updateLocation: (id, changes)=> api.patch(`${BASE}/locations/${id}`, changes).then(r => r.data),
  deleteLocation: (id)         => api.delete(`${BASE}/locations/${id}`).then(r => r.data),

  // ── Visits ────────────────────────────────────────────────────────────────

  recordVisit: (payload)            => api.post(`${BASE}/visits`, payload).then(r => r.data),
  getVisits:   (locationId, limit=50) =>
    api.get(`${BASE}/visits/${locationId}`, { params: { limit } }).then(r => r.data),

  // ── Route planning (Phase 2) ──────────────────────────────────────────────

  /**
   * Calculate + score routes, start a navigation session.
   * @param {{ origin_lat, origin_lng, dest_lat, dest_lng, destination_id? }} payload
   * @returns {{ active_route, all_candidates }}
   */
  startRoute: (payload) => api.post(`${BASE}/route`, payload).then(r => r.data),

  /** Get the user's current active route (or null). */
  getActiveRoute: () => api.get(`${BASE}/route/active`).then(r => r.data),

  /**
   * Ping the server with current GPS — returns deviation level + arrived flag.
   * @param {string} routeId
   * @param {{ latitude, longitude }} position
   */
  pingDeviation: (routeId, position) =>
    api.post(`${BASE}/route/${routeId}/deviation`, position).then(r => r.data),

  /** Cancel the current navigation session. */
  cancelRoute: (routeId) => api.delete(`${BASE}/route/${routeId}`).then(r => r.data),
};