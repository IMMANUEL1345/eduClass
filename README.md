# EduClass — Setup Guide

## Prerequisites
- Node.js 18+
- MySQL 8+

---

## 1. Database

```bash
mysql -u root -p -e "CREATE DATABASE educlass;"
mysql -u root -p educlass < backend/sql/schema.sql
```

Default admin account created by the seed:
- Email: `admin@educlass.school`
- Password: `Admin@123`  ← change immediately after first login

---

## 2. Backend

```bash
cd backend
cp .env.example .env          # fill in DB credentials + JWT secrets
npm install
npm run dev                   # starts on http://localhost:5000
```

Test the API is running:
```
GET http://localhost:5000/health
```

---

## 3. Frontend

```bash
cd frontend
npm install
npm start                     # starts on http://localhost:3000
```

The `"proxy": "http://localhost:5000"` in `package.json` forwards
all `/api/*` calls to the backend during development.

---

## 4. First steps after login

1. Log in as admin → `admin@educlass.school` / `Admin@123`
2. Go to **Classes** → create at least one class (e.g. JHS 1A, 2025/2026)
3. Go to **Teachers** → add teacher accounts
4. Go to **Students** → enrol students into classes
5. Go to **Classes** → add subjects to each class, assign teachers
6. Teachers can now log in and mark attendance + enter grades

---

## Production deployment

```bash
# Backend — build & run with PM2
cd backend
npm install --production
pm2 start server.js --name educlass-api

# Frontend — build static files
cd frontend
npm run build
# Serve the build/ folder via Nginx or any static host
```

Point your Nginx to `frontend/build/` for the React app and
proxy `/api/*` to `localhost:5000` for the backend.

---

## Project structure

```
educlass/
├── backend/
│   ├── server.js              ← entry point
│   ├── config/db.js           ← MySQL pool
│   ├── middleware/            ← auth + error handler
│   ├── controllers/           ← business logic
│   ├── routes/                ← Express routers
│   ├── utils/                 ← helpers, mailer, response
│   ├── jobs.js                ← cron jobs
│   └── sql/schema.sql         ← database schema + seed
│
└── frontend/
    └── src/
        ├── api/index.js       ← all API calls
        ├── store/             ← Redux + auth slice
        ├── components/        ← UI components + layout
        ├── pages/             ← page components by role
        └── utils/             ← grade helpers
```
