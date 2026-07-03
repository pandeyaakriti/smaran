/**
 * navigationSlice.js — Phase 1 + Phase 2
 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { navigationApi } from '../utils/navigationApi';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchLocations = createAsyncThunk(
  'navigation/fetchLocations',
  async (_, { rejectWithValue }) => {
    try { return await navigationApi.listLocations(); }
    catch (e) { return rejectWithValue(e.response?.data?.detail ?? 'Failed to load locations.'); }
  }
);

export const createLocation = createAsyncThunk(
  'navigation/createLocation',
  async (payload, { rejectWithValue }) => {
    try { return await navigationApi.createLocation(payload); }
    catch (e) { return rejectWithValue(e.response?.data?.detail ?? 'Could not save location.'); }
  }
);

export const updateLocation = createAsyncThunk(
  'navigation/updateLocation',
  async ({ id, changes }, { rejectWithValue }) => {
    try { return await navigationApi.updateLocation(id, changes); }
    catch (e) { return rejectWithValue(e.response?.data?.detail ?? 'Could not update location.'); }
  }
);

export const deleteLocation = createAsyncThunk(
  'navigation/deleteLocation',
  async (id, { rejectWithValue }) => {
    try { await navigationApi.deleteLocation(id); return id; }
    catch (e) { return rejectWithValue(e.response?.data?.detail ?? 'Could not delete location.'); }
  }
);

export const recordVisit = createAsyncThunk(
  'navigation/recordVisit',
  async (payload, { rejectWithValue }) => {
    try { return await navigationApi.recordVisit(payload); }
    catch (e) { return rejectWithValue(e.response?.data?.detail ?? 'Visit not recorded.'); }
  }
);

// Phase 2 thunks

export const startRoute = createAsyncThunk(
  'navigation/startRoute',
  async (payload, { rejectWithValue }) => {
    try { return await navigationApi.startRoute(payload); }
    catch (e) { return rejectWithValue(e.response?.data?.detail ?? 'Could not calculate route.'); }
  }
);

export const fetchActiveRoute = createAsyncThunk(
  'navigation/fetchActiveRoute',
  async (_, { rejectWithValue }) => {
    try { return await navigationApi.getActiveRoute(); }
    catch (e) { return rejectWithValue(e.response?.data?.detail ?? 'Could not fetch route.'); }
  }
);

export const cancelRoute = createAsyncThunk(
  'navigation/cancelRoute',
  async (routeId, { rejectWithValue }) => {
    try { await navigationApi.cancelRoute(routeId); return routeId; }
    catch (e) { return rejectWithValue(e.response?.data?.detail ?? 'Could not cancel route.'); }
  }
);


// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState = {
  // GPS
  currentPosition: null,
  gpsError:        null,

  // Saved locations
  locations:       [],
  locationsStatus: 'idle',
  locationsError:  null,

  selectedDestinationId: null,

  // Mutation feedback
  mutationStatus: 'idle',
  mutationError:  null,

  // Phase 2 — active route
  activeRoute:      null,    // ActiveRoute dict from backend
  routeCandidates:  [],      // all scored candidates for display
  routeStatus:      'idle',  // 'idle'|'loading'|'succeeded'|'failed'
  routeError:       null,

  // Deviation
  deviationLevel:   0,       // 0=ok 1=warning 2=caregiver notified
  arrived:          false,
};

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    setCurrentPosition(state, { payload }) {
      state.currentPosition = payload;
      state.gpsError        = null;
    },
    setGpsError(state, { payload }) {
      state.gpsError = payload;
    },
    setSelectedDestination(state, { payload }) {
      state.selectedDestinationId = payload;
    },
    clearMutationError(state) {
      state.mutationError  = null;
      state.mutationStatus = 'idle';
    },
    // Called by useRoute when a deviation ping comes back.
    applyDeviationResult(state, { payload }) {
      state.deviationLevel = payload.new_level;
      state.arrived        = payload.arrived ?? false;
    },
    clearRoute(state) {
      state.activeRoute     = null;
      state.routeCandidates = [];
      state.routeStatus     = 'idle';
      state.routeError      = null;
      state.deviationLevel  = 0;
      state.arrived         = false;
    },
  },
  extraReducers: (builder) => {
    // fetchLocations
    builder
      .addCase(fetchLocations.pending,   (s) => { s.locationsStatus = 'loading'; s.locationsError = null; })
      .addCase(fetchLocations.fulfilled, (s, { payload }) => { s.locationsStatus = 'succeeded'; s.locations = payload; })
      .addCase(fetchLocations.rejected,  (s, { payload }) => { s.locationsStatus = 'failed';    s.locationsError = payload; });

    // createLocation
    builder
      .addCase(createLocation.pending,   (s) => { s.mutationStatus = 'loading'; s.mutationError = null; })
      .addCase(createLocation.fulfilled, (s, { payload }) => { s.mutationStatus = 'succeeded'; s.locations = [payload, ...s.locations]; })
      .addCase(createLocation.rejected,  (s, { payload }) => { s.mutationStatus = 'failed';    s.mutationError = payload; });

    // updateLocation
    builder
      .addCase(updateLocation.pending,   (s) => { s.mutationStatus = 'loading'; })
      .addCase(updateLocation.fulfilled, (s, { payload }) => {
        s.mutationStatus = 'succeeded';
        const idx = s.locations.findIndex(l => l.id === payload.id);
        if (idx !== -1) s.locations[idx] = payload;
      })
      .addCase(updateLocation.rejected,  (s, { payload }) => { s.mutationStatus = 'failed'; s.mutationError = payload; });

    // deleteLocation
    builder
      .addCase(deleteLocation.pending,   (s) => { s.mutationStatus = 'loading'; })
      .addCase(deleteLocation.fulfilled, (s, { payload }) => {
        s.mutationStatus = 'succeeded';
        s.locations = s.locations.filter(l => l.id !== payload);
        if (s.selectedDestinationId === payload) s.selectedDestinationId = null;
      })
      .addCase(deleteLocation.rejected,  (s, { payload }) => { s.mutationStatus = 'failed'; s.mutationError = payload; });

    // startRoute
    builder
      .addCase(startRoute.pending,   (s) => { s.routeStatus = 'loading'; s.routeError = null; s.arrived = false; s.deviationLevel = 0; })
      .addCase(startRoute.fulfilled, (s, { payload }) => {
        s.routeStatus     = 'succeeded';
        s.activeRoute     = payload.active_route;
        s.routeCandidates = payload.all_candidates;
      })
      .addCase(startRoute.rejected,  (s, { payload }) => { s.routeStatus = 'failed'; s.routeError = payload; });

    // fetchActiveRoute
    builder
      .addCase(fetchActiveRoute.fulfilled, (s, { payload }) => {
        if (payload) { s.activeRoute = payload; s.deviationLevel = payload.deviation_level ?? 0; }
      });

    // cancelRoute
    builder
      .addCase(cancelRoute.fulfilled, (s) => {
        s.activeRoute = null; s.routeCandidates = []; s.routeStatus = 'idle';
        s.deviationLevel = 0; s.arrived = false;
      });
  },
});

export const {
  setCurrentPosition, setGpsError, setSelectedDestination,
  clearMutationError, applyDeviationResult, clearRoute,
} = navigationSlice.actions;

export default navigationSlice.reducer;