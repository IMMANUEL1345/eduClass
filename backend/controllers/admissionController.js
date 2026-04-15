const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const { paginate } = require('../utils/helpers');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail } = require('../utils/mailer');

function generateAdmissionNumber(year) {
  const yr = year.replace('/', '').slice(2);
  return `ADM${yr}${Date.now().toString().slice(-4)}`;
}

function generateStudentNumber(year) {
  const yr = year.replace('/', '').slice(2);
  return `STU${yr}${Date.now().toString().slice(-4)}`;
}

// GET /api/admissions
async function list(req, res) {
  const { status, academic_year, search } = req.query;
  const { limit, offset } = paginate(req.query);
  const conditions = ['TRUE']; const params = [];
  if (status)        conditions.push(`a.status = $${params.push(status)}`);
  if (academic_year) conditions.push(`a.academic_year = $${params.push(academic_year)}`);
  if (search)        conditions.push(`a.applicant_name ILIKE $${params.push('%' + search + '%')}`);
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.name AS reviewed_by_name
       FROM admissions a
       LEFT JOIN users u ON u.id = a.reviewed_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.created_at DESC
       LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`, params
    );
    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*) AS total FROM admissions WHERE ${conditions.slice(0, -2).join(' AND ')}`,
      params.slice(0, -2)
    );
    return success(res, { admissions: rows, total: parseInt(total) });
  } catch (err) { return serverError(res, err); }
}

// POST /api/admissions
async function create(req, res) {
  const {
    applicant_name, email, phone, dob, gender, previous_school,
    class_applied, academic_year, parent_name, parent_phone, parent_email, notes
  } = req.body;
  if (!applicant_name || !class_applied) return error(res, 'Applicant name and class applied are required');
  try {
    const admNum = generateAdmissionNumber(academic_year || '2025/2026');
    const { rows: [r] } = await pool.query(
      `INSERT INTO admissions
        (applicant_name,email,phone,dob,gender,previous_school,class_applied,
         academic_year,parent_name,parent_phone,parent_email,notes,
         admission_number,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [applicant_name, email||null, phone||null, dob||null, gender||null,
       previous_school||null, class_applied, academic_year||'2025/2026',
       parent_name||null, parent_phone||null, parent_email||null,
       notes||null, admNum, req.user.id]
    );
    return created(res, { id: r.id, admission_number: admNum }, 'Application submitted');
  } catch (err) { return serverError(res, err); }
}

// GET /api/admissions/:id
async function getOne(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.name AS reviewed_by_name
       FROM admissions a LEFT JOIN users u ON u.id = a.reviewed_by
       WHERE a.id = $1`, [req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Application not found');
    return success(res, rows[0]);
  } catch (err) { return serverError(res, err); }
}

// PUT /api/admissions/:id
async function update(req, res) {
  const fields = ['applicant_name','email','phone','dob','gender',
                  'previous_school','class_applied','academic_year',
                  'parent_name','parent_phone','parent_email','notes'];
  const updates = []; const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = $${params.push(req.body[f])}`);
    }
  });
  if (!updates.length) return error(res, 'No fields to update');
  try {
    await pool.query(
      `UPDATE admissions SET ${updates.join(',')} WHERE id = $${params.push(req.params.id)}`,
      params
    );
    return success(res, {}, 'Application updated');
  } catch (err) { return serverError(res, err); }
}

// POST /api/admissions/:id/approve — approve and auto-create student account
async function approve(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM admissions WHERE id = $1', [req.params.id]);
    const app = rows[0];
    if (!app) return notFound(res, 'Application not found');
    if (app.status === 'enrolled') return error(res, 'Already enrolled');

    // Find class_id by name
    const { rows: classes } = await client.query(
      'SELECT id FROM classes WHERE name ILIKE $1 LIMIT 1', [app.class_applied]
    );
    if (!classes[0]) return error(res, `Class "${app.class_applied}" not found. Create it first.`);

    // Generate student credentials
    const tempPassword = `Edu@${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const hash = await bcrypt.hash(tempPassword, 12);
    const email = app.email || `${app.admission_number.toLowerCase()}@educlass.school`;
    const studentNum = generateStudentNumber(app.academic_year);

    // Create user account
    const { rows: [u] } = await client.query(
      `INSERT INTO users (name, email, password_hash, role, force_password_change)
       VALUES ($1,$2,$3,'student',TRUE) RETURNING id`,
      [app.applicant_name, email, hash]
    );

    // Create student profile
    await client.query(
      `INSERT INTO students (user_id, class_id, student_number, gender, dob, academic_year)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [u.id, classes[0].id, studentNum, app.gender||null, app.dob||null, app.academic_year]
    );

    // Update admission record
    await client.query(
      `UPDATE admissions SET status='enrolled', reviewed_by=$1, reviewed_at=NOW() WHERE id=$2`,
      [req.user.id, req.params.id]
    );

    await client.query('COMMIT');

    // Send welcome email
    sendWelcomeEmail(email, app.applicant_name, 'student', tempPassword).catch(console.error);

    return success(res, { student_number: studentNum, email, temp_password: tempPassword },
      'Applicant approved and student account created');
  } catch (err) {
    await client.query('ROLLBACK');
    return serverError(res, err);
  } finally { client.release(); }
}

// POST /api/admissions/:id/reject
async function reject(req, res) {
  const { reason } = req.body;
  try {
    await pool.query(
      `UPDATE admissions SET status='rejected', reviewed_by=$1, reviewed_at=NOW(),
       notes = COALESCE(notes || E'\n', '') || $2 WHERE id=$3`,
      [req.user.id, reason ? `Rejection reason: ${reason}` : '', req.params.id]
    );
    return success(res, {}, 'Application rejected');
  } catch (err) { return serverError(res, err); }
}

// GET /api/admissions/stats
async function stats(req, res) {
  const { academic_year } = req.query;
  try {
    const yr = academic_year || '2025/2026';
    const { rows: [s] } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='pending')  AS pending,
         COUNT(*) FILTER (WHERE status='approved') AS approved,
         COUNT(*) FILTER (WHERE status='rejected') AS rejected,
         COUNT(*) FILTER (WHERE status='enrolled') AS enrolled,
         COUNT(*) AS total
       FROM admissions WHERE academic_year = $1`, [yr]
    );
    return success(res, s);
  } catch (err) { return serverError(res, err); }
}

module.exports = { list, create, getOne, update, approve, reject, stats };