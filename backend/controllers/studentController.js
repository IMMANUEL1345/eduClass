const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const { generateCode, paginate } = require('../utils/helpers');

async function list(req, res) {
  const { class_id, academic_year, search } = req.query;
  const { limit, offset } = paginate(req.query);
  const conditions = ['TRUE']; const params = [];
  if (class_id)      conditions.push(`s.class_id = $${params.push(class_id)}`);
  if (academic_year) conditions.push(`c.academic_year = $${params.push(academic_year)}`);
  if (search)        { conditions.push(`(u.name ILIKE $${params.push('%'+search+'%')} OR s.student_number ILIKE $${params.push('%'+search+'%')})`); }
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.student_number, s.dob, s.gender, s.enrolled_at,
              u.name, u.email, c.name AS class_name, c.section, c.academic_year
       FROM students s
       JOIN users u   ON u.id = s.user_id
       JOIN classes c ON c.id = s.class_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name, u.name
       LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function create(req, res) {
  const { name, email, password, class_id, dob, gender } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password || 'Student@123', 12);
    const { rows: [u] } = await client.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, email.toLowerCase().trim(), hash, 'student']
    );
    const studentNumber = generateCode('STU');
    await client.query(
      'INSERT INTO students (user_id, student_number, class_id, dob, gender) VALUES ($1,$2,$3,$4,$5)',
      [u.id, studentNumber, class_id, dob || null, gender || null]
    );
    await client.query('COMMIT');
    return created(res, { student_number: studentNumber }, 'Student enrolled');
  } catch (err) { await client.query('ROLLBACK'); return serverError(res, err); }
  finally { client.release(); }
}

async function getOne(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.student_number, s.dob, s.gender, s.enrolled_at,
              u.name, u.email, c.name AS class_name, c.section, c.academic_year
       FROM students s JOIN users u ON u.id = s.user_id JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1`, [req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Student not found');
    return success(res, rows[0]);
  } catch (err) { return serverError(res, err); }
}

async function update(req, res) {
  const { name, class_id, dob, gender } = req.body;
  try {
    const { rows: s } = await pool.query('SELECT user_id FROM students WHERE id = $1', [req.params.id]);
    if (!s[0]) return notFound(res, 'Student not found');
    if (name) await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, s[0].user_id]);
    await pool.query(
      'UPDATE students SET class_id = COALESCE($1,class_id), dob = COALESCE($2,dob), gender = COALESCE($3,gender) WHERE id = $4',
      [class_id||null, dob||null, gender||null, req.params.id]
    );
    return success(res, {}, 'Student updated');
  } catch (err) { return serverError(res, err); }
}

async function remove(req, res) {
  try {
    const { rows } = await pool.query('SELECT user_id FROM students WHERE id = $1', [req.params.id]);
    if (!rows[0]) return notFound(res, 'Student not found');
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = $1', [rows[0].user_id]);
    return success(res, {}, 'Student deactivated');
  } catch (err) { return serverError(res, err); }
}

async function getGrades(req, res) {
  const { term, academic_year, subject_id } = req.query;
  const conditions = [`g.student_id = $1`]; const params = [req.params.id];
  if (term)          conditions.push(`g.term = $${params.push(term)}`);
  if (academic_year) conditions.push(`g.academic_year = $${params.push(academic_year)}`);
  if (subject_id)    conditions.push(`g.subject_id = $${params.push(subject_id)}`);
  try {
    const { rows } = await pool.query(
      `SELECT g.id, g.score, g.letter_grade, g.assessment_type, g.term, g.academic_year, g.created_at,
              sub.name AS subject_name, sub.code AS subject_code
       FROM grades g JOIN subjects sub ON sub.id = g.subject_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY g.academic_year, g.term, sub.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function getAttendance(req, res) {
  const { subject_id } = req.query;
  const conditions = [`a.student_id = $1`]; const params = [req.params.id];
  if (subject_id) conditions.push(`a.subject_id = $${params.push(subject_id)}`);
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.date, a.status, a.notes, sub.name AS subject_name
       FROM attendance a JOIN subjects sub ON sub.id = a.subject_id
       WHERE ${conditions.join(' AND ')} ORDER BY a.date DESC`, params
    );
    const total   = rows.length;
    const present = rows.filter(r => r.status === 'present').length;
    const absent  = rows.filter(r => r.status === 'absent').length;
    const late    = rows.filter(r => r.status === 'late').length;
    const pct     = total > 0 ? Math.round((present / total) * 100) : 0;
    return success(res, { summary: { total, present, absent, late, percentage: pct }, records: rows });
  } catch (err) { return serverError(res, err); }
}

async function getReports(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name AS generated_by_name FROM reports r JOIN users u ON u.id = r.generated_by
       WHERE r.student_id = $1 ORDER BY r.academic_year DESC, r.term`, [req.params.id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

module.exports = { list, create, getOne, update, remove, getGrades, getAttendance, getReports };
