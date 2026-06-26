/**
 * navigationApi
 *
 * Follows the exact same shape as personApi / memoryApi already in the project:
 * - Uses the shared `api` axios instance (Supabase JWT auto-attached via interceptor)
 * - Each method returns the axios response's `.data` directly
 * - Import and add to src/utils/api.js alongside the other domain objects
 *
 * Usage:
 *   import { navigationApi } from './utils/navigationApi';
 *   const locations = await navigationApi.listLocations();
 */

import api from './api'; // the shared axios instance from the existing project

const BASE = '/navigation';

export const navigationApi = {
  // ── Saved locations ──────────────────────────────────────────────────────

  /** Fetch all saved locations for the current user (pinned first). */
  listLocations: () =>
    api.get(`${BASE}/locations`).then((r) => r.data),

  /**
   * Save a new named location.
   * @param {object} payload
   * @param {string} payload.label       - e.g. "Home"
   * @param {number} payload.latitude
   * @param {number} payload.longitude
   * @param {string} [payload.category]  - "home"|"medical"|"social"|"shopping"|"other"
   * @param {string} [payload.notes]     - caregiver tip
   * @param {boolean}[payload.is_pinned]
   */
  createLocation: (payload) =>
    api.post(`${BASE}/locations`, payload).then((r) => r.data),

  /**
   * Update label / notes / pin status of an existing location.
   * @param {string} id
   * @param {object} changes - partial SavedLocation fields
   */
  updateLocation: (id, changes) =>
    api.patch(`${BASE}/locations/${id}`, changes).then((r) => r.data),

  /**
   * Permanently delete a saved location (visits cascade).
   * @param {string} id
   */
  deleteLocation: (id) =>
    api.delete(`${BASE}/locations/${id}`).then((r) => r.data),

  // ── Visit recording ───────────────────────────────────────────────────────

  /**
   * Record that the device was detected near a saved location.
   * Call this from useNavigation when proximity < threshold.
   * @param {object} payload
   * @param {string} payload.saved_location_id
   * @param {number} payload.latitude   - current GPS reading
   * @param {number} payload.longitude
   */
  recordVisit: (payload) =>
    api.post(`${BASE}/visits`, payload).then((r) => r.data),

  /**
   * Fetch recent visits for one saved location (for caregiver view).
   * @param {string} locationId
   * @param {number} [limit=50]
   */
  getVisits: (locationId, limit = 50) =>
    api.get(`${BASE}/visits/${locationId}`, { params: { limit } }).then((r) => r.data),
};