/**
 * navigationSlice.js
 *
 * Redux slice for the navigation feature.
 * Add this reducer to frontend/src/store/index.js under the key "navigation".
 *
 *   import navigationReducer from './navigationSlice';
 *   // inside configureStore reducers:
 *   navigation: navigationReducer,
 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { navigationApi } from '../utils/navigationApi';

// ── Thunks ────────────────────────────────────────────────────────────────

export const fetchLocations = createAsyncThunk(
  'navigation/fetchLocations',
  async (_, { rejectWithValue }) => {
    try {
      return await navigationApi.listLocations();
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to load locations.');
    }
  }
);

export const createLocation = createAsyncThunk(
  'navigation/createLocation',
  async (payload, { rejectWithValue }) => {
    try {
      return await navigationApi.createLocation(payload);
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail ?? 'Could not save location.');
    }
  }
);

export const updateLocation = createAsyncThunk(
  'navigation/updateLocation',
  async ({ id, changes }, { rejectWithValue }) => {
    try {
      return await navigationApi.updateLocation(id, changes);
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail ?? 'Could not update location.');
    }
  }
);

export const deleteLocation = createAsyncThunk(
  'navigation/deleteLocation',
  async (id, { rejectWithValue }) => {
    try {
      await navigationApi.deleteLocation(id);
      return id; // return the id so the reducer can remove it from state
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail ?? 'Could not delete location.');
    }
  }
);

export const recordVisit = createAsyncThunk(
  'navigation/recordVisit',
  async (payload, { rejectWithValue }) => {
    try {
      return await navigationApi.recordVisit(payload);
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail ?? 'Visit not recorded.');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────

const initialState = {
  // Live GPS state (updated by useNavigation hook, never from the server)
  currentPosition: null,   // { latitude, longitude, accuracy, timestamp }
  gpsError: null,

  // Saved locations from backend
  locations: [],
  locationsStatus: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  locationsError: null,

  // The location the user has selected as a destination (Phase 1: UI only)
  selectedDestinationId: null,

  // Mutation feedback
  mutationStatus: 'idle',
  mutationError: null,
};

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    // Called by useNavigation whenever the browser's Geolocation API fires.
    setCurrentPosition(state, action) {
      state.currentPosition = action.payload;
      state.gpsError = null;
    },
    setGpsError(state, action) {
      state.gpsError = action.payload;
    },
    setSelectedDestination(state, action) {
      state.selectedDestinationId = action.payload; // location id or null
    },
    clearMutationError(state) {
      state.mutationError = null;
      state.mutationStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    // fetchLocations
    builder
      .addCase(fetchLocations.pending, (state) => {
        state.locationsStatus = 'loading';
        state.locationsError = null;
      })
      .addCase(fetchLocations.fulfilled, (state, action) => {
        state.locationsStatus = 'succeeded';
        state.locations = action.payload;
      })
      .addCase(fetchLocations.rejected, (state, action) => {
        state.locationsStatus = 'failed';
        state.locationsError = action.payload;
      });

    // createLocation
    builder
      .addCase(createLocation.pending, (state) => {
        state.mutationStatus = 'loading';
        state.mutationError = null;
      })
      .addCase(createLocation.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        state.locations = [action.payload, ...state.locations];
      })
      .addCase(createLocation.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.mutationError = action.payload;
      });

    // updateLocation
    builder
      .addCase(updateLocation.pending, (state) => {
        state.mutationStatus = 'loading';
      })
      .addCase(updateLocation.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        const idx = state.locations.findIndex((l) => l.id === action.payload.id);
        if (idx !== -1) state.locations[idx] = action.payload;
      })
      .addCase(updateLocation.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.mutationError = action.payload;
      });

    // deleteLocation
    builder
      .addCase(deleteLocation.pending, (state) => {
        state.mutationStatus = 'loading';
      })
      .addCase(deleteLocation.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        state.locations = state.locations.filter((l) => l.id !== action.payload);
        if (state.selectedDestinationId === action.payload) {
          state.selectedDestinationId = null;
        }
      })
      .addCase(deleteLocation.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.mutationError = action.payload;
      });
  },
});

export const {
  setCurrentPosition,
  setGpsError,
  setSelectedDestination,
  clearMutationError,
} = navigationSlice.actions;

export default navigationSlice.reducer;