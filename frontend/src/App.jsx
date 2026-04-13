import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import { useSelector } from 'react-redux';
import { selectRole, selectIsLoggedIn } from './store/slices/authSlice';

import { RequireAuth, GuestOnly } from './components/layout/Guards';
import AppLayout from './components/layout/AppLayout';

import Landing      from './pages/Landing';
import Login        from './pages/auth/Login';
import Register     from './pages/auth/Register';

import AdminDashboard   from './pages/admin/Dashboard';
import TeacherDashboard from './pages/teacher/Dashboard';
import Students         from './pages/admin/Students';
import StudentDetail    from './pages/admin/StudentDetail';
import Teachers         from './pages/admin/Teachers';
import Classes          from './pages/admin/Classes';
import Analytics        from './pages/admin/Analytics';

import TeacherAttendance from './pages/teacher/Attendance';
import TeacherGrades     from './pages/teacher/Grades';

import ParentDashboard  from './pages/parent/Dashboard';
import StudentDashboard from './pages/student/Dashboard';

import Reports       from './pages/shared/Reports';
import Messages      from './pages/shared/Messages';
import Announcements from './pages/shared/Announcements';
import Settings      from './pages/shared/Settings';

import AccountantDashboard from './pages/accountant/Dashboard';
import RecordPayment       from './pages/accountant/RecordPayment';
import Defaulters          from './pages/accountant/Defaulters';
import ClearedStudents     from './pages/accountant/ClearedStudents';
import FeeStructures       from './pages/accountant/FeeStructures';
import PaymentHistory      from './pages/accountant/PaymentHistory';

function DashboardRedirect() {
  const role = useSelector(selectRole);
  if (role === 'admin')       return <AdminDashboard />;
  if (role === 'teacher')     return <TeacherDashboard />;
  if (role === 'accountant')  return <AccountantDashboard />;
  if (role === 'parent')      return <ParentDashboard />;
  if (role === 'student')     return <StudentDashboard />;
  // Show nothing while role loads — do NOT auto-logout
  return null;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route element={<GuestOnly />}>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard"           element={<DashboardRedirect />} />
          <Route path="/settings"            element={<Settings />} />
          <Route path="/students"            element={<Students />} />
          <Route path="/students/:id"        element={<StudentDetail />} />
          <Route path="/teachers"            element={<Teachers />} />
          <Route path="/classes"             element={<Classes />} />
          <Route path="/analytics"           element={<Analytics />} />
          <Route path="/attendance"          element={<TeacherAttendance />} />
          <Route path="/grades"              element={<TeacherGrades />} />
          <Route path="/reports"             element={<Reports />} />
          <Route path="/messages"            element={<Messages />} />
          <Route path="/announcements"       element={<Announcements />} />
          <Route path="/my-child"            element={<ParentDashboard />} />
          <Route path="/fees"                element={<AccountantDashboard />} />
          <Route path="/fees/payments/new"   element={<RecordPayment />} />
          <Route path="/fees/payments"       element={<PaymentHistory />} />
          <Route path="/fees/defaulters"     element={<Defaulters />} />
          <Route path="/fees/cleared"        element={<ClearedStudents />} />
          <Route path="/fees/structures"     element={<FeeStructures />} />
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
          toastOptions={{ duration: 3500, style: { fontSize: '13px', borderRadius: '10px' } }}
        />
      </BrowserRouter>
    </Provider>
  );
}