import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI } from '../../api';

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await authAPI.login(credentials);
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const logout = createAsyncThunk('auth/logout', async (_, { getState }) => {
  const { refreshToken } = getState().auth;
  try { await authAPI.logout({ refreshToken }); } catch {}
});

// Use sessionStorage so each tab is independent
const stored = (() => {
  try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; }
})();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:         stored || null,
    token:        sessionStorage.getItem('token') || null,
    refreshToken: sessionStorage.getItem('refreshToken') || null,
    loading:      false,
    error:        null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearForceChange: (state) => {
      if (state.user) {
        state.user.force_password_change = false;
        sessionStorage.setItem('user', JSON.stringify(state.user));
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.loading      = false;
        state.user         = payload.user;
        state.token        = payload.token;
        state.refreshToken = payload.refreshToken;
        sessionStorage.setItem('token',        payload.token);
        sessionStorage.setItem('refreshToken', payload.refreshToken);
        sessionStorage.setItem('user',         JSON.stringify(payload.user));
      })
      .addCase(login.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null; state.token = null; state.refreshToken = null;
        sessionStorage.clear();
      });
  },
});

export const { clearError, clearForceChange } = authSlice.actions;

export const selectUser        = (s) => s.auth.user;
export const selectRole        = (s) => s.auth.user?.role;
export const selectAuthLoading = (s) => s.auth.loading;
export const selectAuthError   = (s) => s.auth.error;
export const selectIsLoggedIn  = (s) => !!s.auth.token;
export const selectForceChange = (s) => s.auth.user?.force_password_change === true;

export default authSlice.reducer;