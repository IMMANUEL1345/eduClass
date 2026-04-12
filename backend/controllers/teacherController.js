const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { success, created, notFound, serverError } = require('../utils/response');
const { generateCode } = require('../utils/helpers');

async function list(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.staff_number, t.specialization, t.phone, u.name, u.email, u.is_active,
              COUNT(DISTINCT sub.id) AS subject_count
       FROM teachers t JOIN users u ON u.id = t.user_id
       LEFT JOIN subjects sub ON sub.teacher_id = u.id
       GROUP BY t.id, u.name, u.email, u.is_active ORDER BY u.name`
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function create(req, res) {
  const { name, email, password, specialization, phone } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password || 'Teacher@123', 12);
    const { rows: [u] } = await client.query(
      'INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, email.toLowerCase().trim(), hash, 'teacher']
    );
    const staffNumber = generateCode('TCH');
    await client.query(
      'INSERT INTO teachers (user_id,staff_number,specialization,phone) VALUES ($1,$2,$3,$4)',
      [u.id, staffNumber, specialization||null, phone||null]
    );
    await client.query('COMMIT');
    return created(res, { staff_number: staffNumber }, 'Teacher account created');
  } catch (err) { await client.query('ROLLBACK'); return serverError(res, err); }
  finally { client.release(); }
}

async function getOne(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.staff_number, t.specialization, t.phone, u.name, u.email, u.is_active, u.created_at
       FROM teachers t JOIN users u ON u.id = t.user_id WHERE t.id = $1`, [req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Teacher not found');
    return success(res, rows[0]);
  } catch (err) { return serverError(res, err); }
}

async function update(req, res) {
  const { name, specialization, phone } = req.body;
  try {
    const { rows } = await pool.query('SELECT user_id FROM teachers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return notFound(res, 'Teacher not found');
    if (name) await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, rows[0].user_id]);
    await pool.query(
      'UPDATE teachers SET specialization=COALESCE($1,specialization), phone=COALESCE($2,phone) WHERE id = $3',
      [specialization||null, phone||null, req.params.id]
    );
    return success(res, {}, 'Teacher updated');
  } catch (err) { return serverError(res, err); }
}

async function getClasses(req, res) {
  try {
    const { rows: t } = await pool.query('SELECT user_id FROM teachers WHERE id = $1', [req.params.id]);
    if (!t[0]) return notFound(res, 'Teacher not found');
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.section, c.academic_year, COUNT(DISTINCT s.id) AS student_count
       FROM classes c LEFT JOIN students s ON s.class_id = c.id
       WHERE c.homeroom_teacher_id = $1
       GROUP BY c.id ORDER BY c.name`, [t[0].user_id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function getSubjects(req, res) {
  try {
    const { rows: t } = await pool.query('SELECT user_id FROM teachers WHERE id = $1', [req.params.id]);
    if (!t[0]) return notFound(res, 'Teacher not found');
    const { rows } = await pool.query(
      `SELECT sub.id, sub.name, sub.code, sub.periods_per_week, c.name AS class_name, c.section
       FROM subjects sub JOIN classes c ON c.id = sub.class_id
       WHERE sub.teacher_id = $1 ORDER BY c.name, sub.name`, [t[0].user_id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

module.exports = { list, create, getOne, update, getClasses, getSubjects };
