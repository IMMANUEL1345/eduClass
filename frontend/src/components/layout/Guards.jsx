import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsLoggedIn, selectRole } from '../../store/slices/authSlice';

// Requires user to be logged in
export function RequireAuth() {
  const isLoggedIn = useSelector(selectIsLoggedIn);
  return isLoggedIn ? <Outlet /> : <Navigate to="/login" replace />;
}

// Requires specific role(s)
export function RequireRole({ roles }) {
  const role = useSelector(selectRole);
  return roles.includes(role) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

// Redirect already-logged-in users away from /login
export function GuestOnly() {
  const isLoggedIn = useSelector(selectIsLoggedIn);
  return isLoggedIn ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
