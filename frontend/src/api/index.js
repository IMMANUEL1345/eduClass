import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 90000,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, refresh token then retry once
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      const refreshToken = sessionStorage.getItem('refreshToken');
      if (!refreshToken) {
        sessionStorage.clear();
        window.location.href = '/login';
        return Promise.reject(err);
      }

      try {
        // Use full URL for refresh so it works on Vercel
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );
        const newToken = data.data.token;
        sessionStorage.setItem('token', newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        sessionStorage.clear();
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }

    return Promise.reject(err);
  }
);

export default api;

export const authAPI = {
  login:          (body) => api.post('/auth/login', body),
  logout:         (body) => api.post('/auth/logout', body),
  forgotPassword: (body) => api.post('/auth/forgot-password', body),
  resetPassword:  (body) => api.post('/auth/reset-password', body),
  register:       (body) => api.post('/auth/register', body),
};

export const studentAPI = {
  list:        (params)   => api.get('/students', { params }),
  create:      (body)     => api.post('/students', body),
  bulkCreate:  (students) => api.post('/students/bulk', { students }),
  myChildren:  ()         => api.get('/students/my-children'),
  getOne:      (id)       => api.get(`/students/${id}`),
  update:      (id, b)    => api.put(`/students/${id}`, b),
  remove:      (id)       => api.delete(`/students/${id}`),
  grades:      (id, p)    => api.get(`/students/${id}/grades`, { params: p }),
  attendance:  (id, p)    => api.get(`/students/${id}/attendance`, { params: p }),
  reports:     (id)       => api.get(`/students/${id}/reports`),
};

export const teacherAPI = {
  list:     (params) => api.get('/teachers', { params }),
  create:   (body)   => api.post('/teachers', body),
  getOne:   (id)     => api.get(`/teachers/${id}`),
  update:   (id, b)  => api.put(`/teachers/${id}`, b),
  classes:  (id)     => api.get(`/teachers/${id}/classes`),
  subjects: (id)     => api.get(`/teachers/${id}/subjects`),
};

export const classAPI = {
  list:          (params) => api.get('/classes', { params }),
  create:        (body)   => api.post('/classes', body),
  getOne:        (id)     => api.get(`/classes/${id}`),
  update:        (id, b)  => api.put(`/classes/${id}`, b),
  students:      (id)     => api.get(`/classes/${id}/students`),
  subjects:      (id)     => api.get(`/classes/${id}/subjects`),
  remove:        (id)     => api.delete(`/classes/${id}`),
  createSubject: (body)   => api.post('/subjects', body),
  removeSubject: (id)     => api.delete(`/subjects/${id}`),
};

export const attendanceAPI = {
  mark:      (body)   => api.post('/attendance', body),
  query:     (params) => api.get('/attendance', { params }),
  update:    (id, b)  => api.put(`/attendance/${id}`, b),
  summary:   (sid, p) => api.get(`/attendance/summary/${sid}`, { params: p }),
  absentees: (params) => api.get('/attendance/absentees', { params }),
};

export const gradeAPI = {
  submit:      (body)   => api.post('/grades', body),
  query:       (params) => api.get('/grades', { params }),
  update:      (id, b)  => api.put(`/grades/${id}`, b),
  remove:      (id)     => api.delete(`/grades/${id}`),
  leaderboard: (cid, p) => api.get(`/grades/leaderboard/${cid}`, { params: p }),
};

export const reportAPI = {
  attendanceReport:    (params) => api.get("/reports/attendance", { params }),
  enrollmentReport:    (params) => api.get("/reports/enrollment", { params }),
  feeCollectionReport: (params) => api.get("/reports/fee-collection", { params }),
  expenseSummaryReport:(params) => api.get("/reports/expense-summary", { params }),
  generate:  (body)   => api.post('/reports/generate', body),
  getOne:    (id)     => api.get(`/reports/${id}`),
  byStudent: (sid)    => api.get(`/reports/student/${sid}`),
  byClass:   (cid, p) => api.get(`/reports/class/${cid}`, { params: p }),
};

export const analyticsAPI = {
  overview:         ()       => api.get('/analytics/overview'),
  attendanceTrend:  (params) => api.get('/analytics/attendance-trend', { params }),
  gradeDistrib:     (params) => api.get('/analytics/grade-distribution', { params }),
  classPerformance: (params) => api.get('/analytics/class-performance', { params }),
  studentProgress:  (id)     => api.get(`/analytics/student-progress/${id}`),
};

export const commsAPI = {
  inbox:              ()      => api.get('/messages/inbox'),
  searchUsers:        (q)     => api.get('/users/search', { params: { q } }),
  sent:               ()      => api.get('/messages/sent'),
  send:               (body)  => api.post('/messages', body),
  getMessage:         (id)    => api.get(`/messages/${id}`),
  markMessageRead:    (id)    => api.put(`/messages/${id}/read`),
  deleteMessage:      (id)    => api.delete(`/messages/${id}`),
  announcements:      ()      => api.get('/announcements'),
  createAnnouncement: (body)  => api.post('/announcements', body),
  notifications:      ()      => api.get('/notifications'),
  markNotifRead:      (id)    => api.put(`/notifications/${id}/read`),
  markAllNotifsRead:  ()      => api.put('/notifications/read-all'),
  deleteNotif:        (id)    => api.delete(`/notifications/${id}`),
};

export const feeAPI = {
  listStructures:  (params)    => api.get('/fees/structures', { params }),
  createStructure: (body)      => api.post('/fees/structures', body),
  updateStructure: (id, body)  => api.put(`/fees/structures/${id}`, body),
  listPayments:    (params)    => api.get('/fees/payments', { params }),
  recordPayment:   (body)      => api.post('/fees/payments', body),
  studentBalance:  (id, params)=> api.get(`/fees/balance/${id}`, { params }),
  defaulters:      (params)    => api.get('/fees/defaulters', { params }),
  cleared:         (params)    => api.get('/fees/cleared', { params }),
  summary:         (params)    => api.get('/fees/summary', { params }),
};

export const admissionAPI = {
  list:    (params)  => api.get('/admissions', { params }),
  create:  (body)    => api.post('/admissions', body),
  getOne:  (id)      => api.get(`/admissions/${id}`),
  update:  (id, b)   => api.put(`/admissions/${id}`, b),
  approve: (id)      => api.post(`/admissions/${id}/approve`),
  reject:  (id, b)   => api.post(`/admissions/${id}/reject`, b),
  stats:   (params)  => api.get('/admissions/stats', { params }),
};

export const inventoryAPI = {
  listItems:    (params)     => api.get('/inventory/items', { params }),
  createItem:   (body)       => api.post('/inventory/items', body),
  updateItem:   (id, body)   => api.put(`/inventory/items/${id}`, body),
  adjustStock:  (id, body)   => api.put(`/inventory/items/${id}/stock`, body),
  listSales:    (params)     => api.get('/inventory/sales', { params }),
  recordSale:   (body)       => api.post('/inventory/sales', body),
  salesSummary: (params)     => api.get('/inventory/summary', { params }),
};

export const expenseAPI = {
  list:    (params) => api.get('/expenses', { params }),
  create:  (body)   => api.post('/expenses', body),
  update:  (id, b)  => api.put(`/expenses/${id}`, b),
  approve: (id)     => api.post(`/expenses/${id}/approve`),
  reject:  (id)     => api.post(`/expenses/${id}/reject`),
  remove:  (id)     => api.delete(`/expenses/${id}`),
  summary: (params) => api.get('/expenses/summary', { params }),
};

export const timetableAPI = {
  getClass:          (params) => api.get('/timetable/class', { params }),
  getTeacher:        (params) => api.get('/timetable/teacher', { params }),
  generate:          (body)   => api.post('/timetable/generate', body),
  regenerate:        (body)   => api.post('/timetable/regenerate', body),
  approve:           (body)   => api.post('/timetable/approve', body),
  addEntry:          (body)   => api.post('/timetable', body),
  updateEntry:       (id, b)  => api.put(`/timetable/${id}`, b),
  removeEntry:       (id)     => api.delete(`/timetable/${id}`),
  listAssignments:   (params) => api.get('/timetable/assignments', { params }),
  assign:            (body)   => api.post('/timetable/assignments', body),
  removeAssignment:  (id)     => api.delete(`/timetable/assignments/${id}`),
};

export const staffAttendanceAPI = {
  checkIn:      ()       => api.post('/staff-attendance/check-in'),
  checkOut:     ()       => api.post('/staff-attendance/check-out'),
  today:        ()       => api.get('/staff-attendance/today'),
  myHistory:    (params) => api.get('/staff-attendance/my-history', { params }),
  daily:        (params) => api.get('/staff-attendance/daily', { params }),
  report:       (params) => api.get('/staff-attendance/report', { params }),
  manual:       (body)   => api.post('/staff-attendance/manual', body),
};