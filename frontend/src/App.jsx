import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import { useSelector } from 'react-redux';
import { selectRole } from './store/slices/authSlice';

import { RequireAuth, GuestOnly } from './components/layout/Guards';
import AppLayout from './components/layout/AppLayout';

// Auth
import Login from './pages/auth/Login';

// Admin
import AdminDashboard from './pages/admin/Dashboard';
import Students       from './pages/admin/Students';
import Teachers       from './pages/admin/Teachers';
import Classes        from './pages/admin/Classes';
import Analytics      from './pages/admin/Analytics';

// Teacher
import TeacherAttendance from './pages/teacher/Attendance';
import TeacherGrades     from './pages/teacher/Grades';

// Parent
import ParentDashboard from './pages/parent/Dashboard';

// Student
import StudentDashboard from './pages/student/Dashboard';

// Shared
import Reports       from './pages/shared/Reports';
import Messages      from './pages/shared/Messages';
import Announcements from './pages/shared/Announcements';

function DashboardRedirect() {
  const role = useSelector(selectRole);
  if (role === 'admin')   return <AdminDashboard />;
  if (role === 'teacher') return <AdminDashboard />;
  if (role === 'parent')  return <ParentDashboard />;
  if (role === 'student') return <StudentDashboard />;
  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard"      element={<DashboardRedirect />} />

          {/* Admin-only */}
          <Route path="/students"       element={<Students />} />
          <Route path="/teachers"       element={<Teachers />} />
          <Route path="/classes"        element={<Classes />} />
          <Route path="/analytics"      element={<Analytics />} />

          {/* Teacher + admin */}
          <Route path="/attendance"     element={<TeacherAttendance />} />
          <Route path="/grades"         element={<TeacherGrades />} />

          {/* Shared across all roles */}
          <Route path="/reports"        element={<Reports />} />
          <Route path="/messages"       element={<Messages />} />
          <Route path="/announcements"  element={<Announcements />} />

          {/* Parent */}
          <Route path="/my-child"       element={<ParentDashboard />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { fontSize: '13px', borderRadius: '10px' },
          }}
        />
      </BrowserRouter>
    </Provider>
  );
}
