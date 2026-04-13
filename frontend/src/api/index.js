import axios from 'axios';

const api = axios.create({
  // In production (Vercel), REACT_APP_API_URL = https://your-app.onrender.com/api
  // In development, falls back to '/api' which is proxied by CRA to localhost:5000
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 90000, // 90 seconds — Render free tier needs up to 60s to wake up
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, try refresh — then retry original request once
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    // Only attempt refresh on 401 — ignore all other errors (500, network, etc.)
    if (err.response?.status === 401 && !original._retry) {
      // Don't try to refresh if we're already on an auth endpoint
      if (original.url?.includes('/auth/')) {
        return Promise.reject(err);
      }
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(err);
        }
        const baseURL = process.env.REACT_APP_API_URL || '/api';
        const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        localStorage.setItem('token', data.data.token);
        original.headers.Authorization = `Bearer ${data.data.token}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Typed endpoint helpers ────────────────────────────────
export const authAPI = {
  login:         (body) => api.post('/auth/login', body),
  logout:        (body) => api.post('/auth/logout', body),
  forgotPassword:(body) => api.post('/auth/forgot-password', body),
  resetPassword: (body) => api.post('/auth/reset-password', body),
  register:      (body) => api.post('/auth/register', body),
};

export const studentAPI = {
  list:          (params) => api.get('/students', { params }),
  create:        (body)   => api.post('/students', body),
  getOne:        (id)     => api.get(`/students/${id}`),
  update:        (id, b)  => api.put(`/students/${id}`, b),
  remove:        (id)     => api.delete(`/students/${id}`),
  grades:        (id, p)  => api.get(`/students/${id}/grades`, { params: p }),
  attendance:    (id, p)  => api.get(`/students/${id}/attendance`, { params: p }),
  reports:       (id)     => api.get(`/students/${id}/reports`),
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
  list:        (params) => api.get('/classes', { params }),
  create:      (body)   => api.post('/classes', body),
  getOne:      (id)     => api.get(`/classes/${id}`),
  update:      (id, b)  => api.put(`/classes/${id}`, b),
  students:    (id)     => api.get(`/classes/${id}/students`),
  subjects:    (id)     => api.get(`/classes/${id}/subjects`),
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
  generate:   (body)   => api.post('/reports/generate', body),
  getOne:     (id)     => api.get(`/reports/${id}`),
  byStudent:  (sid)    => api.get(`/reports/student/${sid}`),
  byClass:    (cid, p) => api.get(`/reports/class/${cid}`, { params: p }),
};

export const analyticsAPI = {
  overview:         ()       => api.get('/analytics/overview'),
  attendanceTrend:  (params) => api.get('/analytics/attendance-trend', { params }),
  gradeDistrib:     (params) => api.get('/analytics/grade-distribution', { params }),
  classPerformance: (params) => api.get('/analytics/class-performance', { params }),
  studentProgress:  (id)     => api.get(`/analytics/student-progress/${id}`),
};

export const commsAPI = {
  inbox:                ()      => api.get('/messages/inbox'),
  sent:                 ()      => api.get('/messages/sent'),
  send:                 (body)  => api.post('/messages', body),
  getMessage:           (id)    => api.get(`/messages/${id}`),
  markMessageRead:      (id)    => api.put(`/messages/${id}/read`),
  deleteMessage:        (id)    => api.delete(`/messages/${id}`),
  announcements:        ()      => api.get('/announcements'),
  createAnnouncement:   (body)  => api.post('/announcements', body),
  notifications:        ()      => api.get('/notifications'),
  markNotifRead:        (id)    => api.put(`/notifications/${id}/read`),
  markAllNotifsRead:    ()      => api.put('/notifications/read-all'),
  deleteNotif:          (id)    => api.delete(`/notifications/${id}`),
};

// Additional classAPI method used in Classes.jsx
export const classAPI_ext = {
  createSubject: (body)   => api.post('/subjects', body),
  removeSubject: (id)     => api.delete(`/subjects/${id}`),
};

export const feeAPI = {
  listStructures: (params)    => api.get('/fees/structures', { params }),
  createStructure:(body)      => api.post('/fees/structures', body),
  updateStructure:(id, body)  => api.put(`/fees/structures/${id}`, body),
  listPayments:   (params)    => api.get('/fees/payments', { params }),
  recordPayment:  (body)      => api.post('/fees/payments', body),
  studentBalance: (id, params)=> api.get(`/fees/balance/${id}`, { params }),
  defaulters:     (params)    => api.get('/fees/defaulters', { params }),
  cleared:        (params)    => api.get('/fees/cleared', { params }),
  summary:        (params)    => api.get('/fees/summary', { params }),
};

export const authAPI_ext = {
  register: (body) => api.post('/auth/register', body),
};