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

const stored = localStorage.getItem('user');

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:         stored ? JSON.parse(stored) : null,
    token:        localStorage.getItem('token') || null,
    refreshToken: localStorage.getItem('refreshToken') || null,
    loading:      false,
    error:        null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.loading      = false;
        state.user         = payload.user;
        state.token        = payload.token;
        state.refreshToken = payload.refreshToken;
        localStorage.setItem('token',        payload.token);
        localStorage.setItem('refreshToken', payload.refreshToken);
        localStorage.setItem('user',         JSON.stringify(payload.user));
      })
      .addCase(login.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null; state.token = null; state.refreshToken = null;
        localStorage.clear();
      });
  },
});

export const { clearError } = authSlice.actions;

export const selectUser         = (s) => s.auth.user;
export const selectRole         = (s) => s.auth.user?.role;
export const selectAuthLoading  = (s) => s.auth.loading;
export const selectAuthError    = (s) => s.auth.error;
export const selectIsLoggedIn   = (s) => !!s.auth.token;

export default authSlice.reducer;
