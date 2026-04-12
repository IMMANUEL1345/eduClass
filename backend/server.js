require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { testConnection } = require('./config/db');
const { globalErrorHandler } = require('./middleware/errorHandler');
const { startJobs } = require('./jobs');

const authRoutes       = require('./routes/auth');
const feeRoutes        = require('./routes/fees');
const { register }     = require('./controllers/registerController');
const studentRoutes    = require('./routes/students');
const teacherRoutes    = require('./routes/teachers');
const classRoutes      = require('./routes/classes');
const subjectRoutes    = require('./routes/subjects');
const attendanceRoutes = require('./routes/attendance');
const gradeRoutes      = require('./routes/grades');
const reportRoutes     = require('./routes/reports');
const commsRoutes      = require('./routes/comms');
const analyticsRoutes  = require('./routes/analytics');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS ─────────────────────────────────────────────────
const ALLOWED = [
  'https://edu-class-pi.vercel.app',
  process.env.APP_URL,
  'http://localhost:3000',
  'http://localhost:5000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origin.match(/https:\/\/educlass.*\.vercel\.app$/)) return cb(null, true);
    if (ALLOWED.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, env: process.env.NODE_ENV, timestamp: new Date() }));

// ── API routes ───────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/fees',       feeRoutes);
app.post('/api/auth/register', register);
app.use('/api/students',   studentRoutes);
app.use('/api/teachers',   teacherRoutes);
app.use('/api/classes',    classRoutes);
app.use('/api/subjects',   subjectRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/grades',     gradeRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/api',            commsRoutes);

// ── Serve React build in desktop (Electron) mode ─────────
// When packaged as a desktop app, Express serves the frontend too.
if (process.env.DESKTOP_MODE === 'true' || process.env.NODE_ENV === 'desktop') {
  const frontendBuild = path.join(__dirname, '../frontend/build');
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendBuild, 'index.html'));
    }
  });
}

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ ok: false, message: `Route ${req.method} ${req.path} not found` }));

// ── Global error handler ─────────────────────────────────
app.use(globalErrorHandler);

async function start() {
  await testConnection();
  if (process.env.NODE_ENV !== 'test') startJobs();
  app.listen(PORT, () => {
    console.log(`EduClass API running on http://localhost:${PORT}`);
    console.log(`Mode: ${process.env.DESKTOP_MODE === 'true' ? 'desktop' : 'cloud'}`);
  });
}

start();
module.exports = app;