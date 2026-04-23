import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import { useSelector } from 'react-redux';
import { selectRole, selectIsLoggedIn, selectForceChange } from './store/slices/authSlice';

import { RequireAuth, GuestOnly } from './components/layout/Guards';
import AppLayout from './components/layout/AppLayout';

import Landing             from './pages/Landing';
import Login               from './pages/auth/Login';
import Register            from './pages/auth/Register';
import ForceChangePassword from './pages/auth/ForceChangePassword';

// Admin
import AdminDashboard   from './pages/admin/Dashboard';
import Students         from './pages/admin/Students';
import StudentDetail    from './pages/admin/StudentDetail';
import Teachers         from './pages/admin/Teachers';
import Classes          from './pages/admin/Classes';
import Analytics        from './pages/admin/Analytics';
import UserManagement   from './pages/admin/UserManagement';

// Teacher
import TeacherDashboard  from './pages/teacher/Dashboard';
import TeacherAttendance from './pages/teacher/Attendance';
import TeacherGrades     from './pages/teacher/Grades';

// Parent / Student
import ParentDashboard  from './pages/parent/Dashboard';
import StudentDashboard from './pages/student/Dashboard';

// Shared
import Reports       from './pages/shared/Reports';
import Messages      from './pages/shared/Messages';
import Announcements from './pages/shared/Announcements';
import Settings        from './pages/shared/Settings';
import StaffCheckIn    from './pages/shared/StaffCheckIn';
import StaffAttendance from './pages/admin/StaffAttendance';

// Accountant / fees
import AccountantDashboard from './pages/accountant/Dashboard';
import RecordPayment       from './pages/accountant/RecordPayment';
import Defaulters          from './pages/accountant/Defaulters';
import ClearedStudents     from './pages/accountant/ClearedStudents';
import FeeStructures       from './pages/accountant/FeeStructures';
import PaymentHistory      from './pages/accountant/PaymentHistory';
import Expenses            from './pages/accountant/Expenses';
import Inventory           from './pages/accountant/Inventory';
import POS                 from './pages/accountant/POS';

// Admissions
import AdmissionsDashboard from './pages/admissions/Dashboard';
import AdmissionsList      from './pages/admissions/AdmissionsList';
import NewAdmission        from './pages/admissions/NewAdmission';
import AdmissionDetail     from './pages/admissions/AdmissionDetail';

function DashboardRedirect() {
  const role        = useSelector(selectRole);
  const forceChange = useSelector(selectForceChange);
  if (forceChange) return <Navigate to="/change-password" replace />;
  if (role === 'admin')              return <AdminDashboard />;
  if (role === 'teacher')            return <TeacherDashboard />;
  if (role === 'accountant')         return <AccountantDashboard />;
  if (role === 'cashier')            return <Navigate to="/inventory/pos" replace />;
  if (role === 'admissions_officer') return <Navigate to="/admissions" replace />;
  if (role === 'headmaster')         return <AdminDashboard />;
  if (role === 'parent')             return <ParentDashboard />;
  if (role === 'student')            return <StudentDashboard />;
  return null;
}

function ForceChangeGuard() {
  const isLoggedIn  = useSelector(selectIsLoggedIn);
  const forceChange = useSelector(selectForceChange);
  if (!isLoggedIn)  return <Navigate to="/login" replace />;
  if (!forceChange) return <Navigate to="/dashboard" replace />;
  return <ForceChangePassword />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/change-password" element={<ForceChangeGuard />} />

      <Route element={<GuestOnly />}>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard"           element={<DashboardRedirect />} />
          <Route path="/settings"            element={<Settings />} />
          <Route path="/check-in"            element={<StaffCheckIn />} />
          <Route path="/staff-attendance"    element={<StaffAttendance />} />

          {/* Admin */}
          <Route path="/users"               element={<UserManagement />} />
          <Route path="/students"            element={<Students />} />
          <Route path="/students/:id"        element={<StudentDetail />} />
          <Route path="/teachers"            element={<Teachers />} />
          <Route path="/classes"             element={<Classes />} />
          <Route path="/analytics"           element={<Analytics />} />

          {/* Academic */}
          <Route path="/attendance"          element={<TeacherAttendance />} />
          <Route path="/grades"              element={<TeacherGrades />} />
          <Route path="/reports"             element={<Reports />} />
          <Route path="/messages"            element={<Messages />} />
          <Route path="/announcements"       element={<Announcements />} />
          <Route path="/my-child"            element={<ParentDashboard />} />

          {/* Fees */}
          <Route path="/fees"                element={<AccountantDashboard />} />
          <Route path="/fees/payments/new"   element={<RecordPayment />} />
          <Route path="/fees/payments"       element={<PaymentHistory />} />
          <Route path="/fees/defaulters"     element={<Defaulters />} />
          <Route path="/fees/cleared"        element={<ClearedStudents />} />
          <Route path="/fees/structures"     element={<FeeStructures />} />

          {/* Finance */}
          <Route path="/expenses"            element={<Expenses />} />
          <Route path="/inventory"           element={<Inventory />} />
          <Route path="/inventory/pos"       element={<POS />} />

          {/* Admissions */}
          <Route path="/admissions"          element={<AdmissionsDashboard />} />
          <Route path="/admissions/list"     element={<AdmissionsList />} />
          <Route path="/admissions/new"      element={<NewAdmission />} />
          <Route path="/admissions/:id"      element={<AdmissionDetail />} />
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
        <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '13px', borderRadius: '10px' } }} />
      </BrowserRouter>
    </Provider>
  );
}