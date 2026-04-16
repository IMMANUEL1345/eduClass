const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');

const LATE_HOUR   = 8;  // 8:00 AM = late threshold
const LATE_MINUTE = 0;

// POST /api/staff-attendance/check-in
async function checkIn(req, res) {
  const now  = new Date();
  const date = now.toISOString().split('T')[0];
  try {
    // Check if already checked in today
    const { rows: existing } = await pool.query(
      'SELECT id, check_out_time FROM staff_attendance WHERE user_id=$1 AND date=$2',
      [req.user.id, date]
    );
    if (existing[0]) {
      if (!existing[0].check_out_time) {
        return error(res, 'Already checked in today. Use check-out when leaving.');
      }
      return error(res, 'Already completed attendance for today.');
    }
    // Determine status
    const hour   = now.getHours();
    const minute = now.getMinutes();
    const isLate = hour > LATE_HOUR || (hour === LATE_HOUR && minute > LATE_MINUTE);
    const status = isLate ? 'late' : 'present';

    await pool.query(
      `INSERT INTO staff_attendance (user_id, date, check_in_time, status)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, date, now.toTimeString().slice(0,8), status]
    );
    return created(res, {
      check_in_time: now.toTimeString().slice(0,5),
      status,
      message: isLate
        ? `Checked in at ${now.toTimeString().slice(0,5)} — marked as late`
        : `Checked in at ${now.toTimeString().slice(0,5)} — on time`,
    });
  } catch (err) { return serverError(res, err); }
}

// POST /api/staff-attendance/check-out
async function checkOut(req, res) {
  const date = new Date().toISOString().split('T')[0];
  const now  = new Date().toTimeString().slice(0,8);
  try {
    const { rows } = await pool.query(
      'SELECT id, check_in_time, check_out_time FROM staff_attendance WHERE user_id=$1 AND date=$2',
      [req.user.id, date]
    );
    if (!rows[0])             return error(res, 'You have not checked in today.');
    if (rows[0].check_out_time) return error(res, 'Already checked out today.');

    await pool.query(
      'UPDATE staff_attendance SET check_out_time=$1 WHERE id=$2',
      [now, rows[0].id]
    );

    // Calculate hours worked
    const inParts  = rows[0].check_in_time.split(':');
    const outParts = now.split(':');
    const inMins   = parseInt(inParts[0])*60 + parseInt(inParts[1]);
    const outMins  = parseInt(outParts[0])*60 + parseInt(outParts[1]);
    const duration = outMins - inMins;
    const hours    = Math.floor(duration/60);
    const mins     = duration % 60;

    return success(res, {
      check_out_time: now.slice(0,5),
      duration: `${hours}h ${mins}m`,
      message: `Checked out at ${now.slice(0,5)}. Duration: ${hours}h ${mins}m`,
    });
  } catch (err) { return serverError(res, err); }
}

// GET /api/staff-attendance/today — user's own today status
async function todayStatus(req, res) {
  const date = new Date().toISOString().split('T')[0];
  try {
    const { rows } = await pool.query(
      'SELECT * FROM staff_attendance WHERE user_id=$1 AND date=$2',
      [req.user.id, date]
    );
    return success(res, rows[0] || null);
  } catch (err) { return serverError(res, err); }
}

// GET /api/staff-attendance/my-history
async function myHistory(req, res) {
  const { from, to } = req.query;
  const conditions = ['user_id=$1']; const params = [req.user.id];
  if (from) conditions.push(`date >= $${params.push(from)}`);
  if (to)   conditions.push(`date <= $${params.push(to)}`);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM staff_attendance WHERE ${conditions.join(' AND ')} ORDER BY date DESC LIMIT 60`,
      params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// GET /api/staff-attendance/daily?date= — admin overview of all staff
async function dailyOverview(req, res) {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  try {
    // All active non-student non-parent staff
    const { rows: allStaff } = await pool.query(
      `SELECT u.id, u.name, u.role FROM users u
       WHERE u.is_active=TRUE
         AND u.role NOT IN ('student','parent')
       ORDER BY u.role, u.name`
    );
    const { rows: attended } = await pool.query(
      'SELECT * FROM staff_attendance WHERE date=$1', [date]
    );
    const attendedMap = {};
    attended.forEach(a => { attendedMap[a.user_id] = a; });

    const result = allStaff.map(s => ({
      ...s,
      attendance: attendedMap[s.id] || null,
      status: attendedMap[s.id]?.status || 'absent',
    }));

    const summary = {
      total:   allStaff.length,
      present: result.filter(r => r.status === 'present').length,
      late:    result.filter(r => r.status === 'late').length,
      absent:  result.filter(r => r.status === 'absent').length,
    };

    return success(res, { date, summary, staff: result });
  } catch (err) { return serverError(res, err); }
}

// GET /api/staff-attendance/report?user_id=&month=&year=
async function report(req, res) {
  const { user_id, month, year } = req.query;
  const yr = year || new Date().getFullYear();
  const mn = month || (new Date().getMonth()+1);
  const conditions = [
    `EXTRACT(YEAR FROM date) = $1`,
    `EXTRACT(MONTH FROM date) = $2`,
  ]; const params = [yr, mn];
  if (user_id) conditions.push(`user_id = $${params.push(user_id)}`);
  try {
    const { rows } = await pool.query(
      `SELECT sa.*, u.name, u.role
       FROM staff_attendance sa JOIN users u ON u.id=sa.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.name, sa.date`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// POST /api/staff-attendance/manual — admin manually marks attendance
async function manual(req, res) {
  const { user_id, date, status, notes } = req.body;
  if (!user_id || !date || !status) return error(res, 'user_id, date and status required');
  try {
    await pool.query(
      `INSERT INTO staff_attendance (user_id, date, status, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, date)
       DO UPDATE SET status=$3, notes=$4, recorded_by=$5`,
      [user_id, date, status, notes||null, req.user.id]
    );
    return success(res, {}, 'Attendance recorded');
  } catch (err) { return serverError(res, err); }
}

module.exports = { checkIn, checkOut, todayStatus, myHistory, dailyOverview, report, manual };