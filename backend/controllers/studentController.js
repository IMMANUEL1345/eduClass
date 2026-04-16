const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const { generateCode, paginate } = require('../utils/helpers');
const { sendWelcomeEmail } = require('../utils/mailer');

async function list(req, res) {
  const { class_id, academic_year, search } = req.query;
  const { limit, offset } = paginate(req.query);
  const conditions = ['TRUE']; const params = [];
  if (class_id)      conditions.push(`s.class_id = $${params.push(class_id)}`);
  if (academic_year) conditions.push(`s.academic_year = $${params.push(academic_year)}`);
  if (search) {
    conditions.push(`(u.name ILIKE $${params.push('%'+search+'%')} OR s.student_number ILIKE $${params.push('%'+search+'%')})`);
  }
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.student_number, s.dob, s.gender, s.enrolled_at, s.academic_year,
              u.name, u.email, c.name AS class_name, c.section
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
  const { name, email, password, class_id, dob, gender, academic_year } = req.body;
  if (!name || !email || !class_id) return error(res, 'Name, email and class are required');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase().trim()]);
    if (existing[0]) return error(res, 'Email already in use', 409);
    const tempPw = password || `Student@${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const hash = await bcrypt.hash(tempPw, 12);
    const { rows: [u] } = await client.query(
      'INSERT INTO users (name,email,password_hash,role,force_password_change) VALUES ($1,$2,$3,$4,TRUE) RETURNING id',
      [name, email.toLowerCase().trim(), hash, 'student']
    );
    const studentNumber = generateCode('STU');
    await client.query(
      'INSERT INTO students (user_id,student_number,class_id,dob,gender,academic_year) VALUES ($1,$2,$3,$4,$5,$6)',
      [u.id, studentNumber, class_id, dob||null, gender||null, academic_year||`${new Date().getFullYear()}/${new Date().getFullYear()+1}`]
    );
    await client.query('COMMIT');
    sendWelcomeEmail(email.toLowerCase().trim(), name, 'student', tempPw).catch(console.error);
    return created(res, { student_number: studentNumber }, 'Student enrolled. Welcome email sent.');
  } catch (err) { await client.query('ROLLBACK'); return serverError(res, err); }
  finally { client.release(); }
}

// POST /api/students/bulk — CSV bulk enrollment
async function bulkCreate(req, res) {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0)
    return error(res, 'students array is required');

  const results = { created: 0, failed: 0, errors: [] };
  const CURRENT_YEAR = `${new Date().getFullYear()}/${new Date().getFullYear()+1}`;

  for (const s of students) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (!s.name || !s.email || !s.class_name) {
        results.failed++;
        results.errors.push(`Row skipped: name, email or class_name missing`);
        await client.query('ROLLBACK');
        continue;
      }
      // Find class by name
      const { rows: cls } = await client.query(
        'SELECT id FROM classes WHERE name ILIKE $1 LIMIT 1', [s.class_name.trim()]
      );
      if (!cls[0]) {
        results.failed++;
        results.errors.push(`Class "${s.class_name}" not found for ${s.name}`);
        await client.query('ROLLBACK');
        continue;
      }
      // Check email
      const { rows: existing } = await client.query('SELECT id FROM users WHERE email=$1', [s.email.toLowerCase().trim()]);
      if (existing[0]) {
        results.failed++;
        results.errors.push(`Email ${s.email} already in use`);
        await client.query('ROLLBACK');
        continue;
      }
      const tempPw = `Student@${Math.random().toString(36).slice(2,6).toUpperCase()}`;
      const hash = await bcrypt.hash(tempPw, 12);
      const { rows: [u] } = await client.query(
        'INSERT INTO users (name,email,password_hash,role,force_password_change) VALUES ($1,$2,$3,$4,TRUE) RETURNING id',
        [s.name, s.email.toLowerCase().trim(), hash, 'student']
      );
      const studentNumber = s.student_number || generateCode('STU');
      await client.query(
        'INSERT INTO students (user_id,student_number,class_id,dob,gender,academic_year) VALUES ($1,$2,$3,$4,$5,$6)',
        [u.id, studentNumber, cls[0].id, s.dob||null, s.gender||null, s.academic_year||CURRENT_YEAR]
      );
      await client.query('COMMIT');
      sendWelcomeEmail(s.email.toLowerCase().trim(), s.name, 'student', tempPw).catch(console.error);
      results.created++;
    } catch (err) {
      await client.query('ROLLBACK');
      results.failed++;
      results.errors.push(`${s.name || 'Unknown'}: ${err.message}`);
    } finally { client.release(); }
  }
  return success(res, results, `Bulk enrollment complete: ${results.created} enrolled, ${results.failed} failed`);
}

// GET /api/students/my-children — children linked to logged-in parent
async function myChildren(req, res) {
  try {
    const { rows: parent } = await pool.query(
      'SELECT id FROM parents WHERE user_id = $1', [req.user.id]
    );
    if (!parent[0]) return success(res, []);
    const { rows } = await pool.query(
      `SELECT s.id, s.student_number, s.gender, s.academic_year,
              u.name, u.email,
              c.name AS class_name, c.section
       FROM parent_student ps
       JOIN students s ON s.id = ps.student_id
       JOIN users u    ON u.id = s.user_id
       JOIN classes c  ON c.id = s.class_id
       WHERE ps.parent_id = $1
       ORDER BY u.name`, [parent[0].id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function getOne(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.student_number, s.dob, s.gender, s.enrolled_at, s.academic_year,
              u.name, u.email, c.name AS class_name, c.section
       FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id
       WHERE s.id=$1`, [req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Student not found');
    return success(res, rows[0]);
  } catch (err) { return serverError(res, err); }
}

async function update(req, res) {
  const { name, class_id, dob, gender, academic_year } = req.body;
  try {
    const { rows: s } = await pool.query('SELECT user_id FROM students WHERE id=$1', [req.params.id]);
    if (!s[0]) return notFound(res, 'Student not found');
    if (name) await pool.query('UPDATE users SET name=$1 WHERE id=$2', [name, s[0].user_id]);
    await pool.query(
      `UPDATE students SET
         class_id     = COALESCE($1, class_id),
         dob          = COALESCE($2, dob),
         gender       = COALESCE($3, gender),
         academic_year= COALESCE($4, academic_year)
       WHERE id=$5`,
      [class_id||null, dob||null, gender||null, academic_year||null, req.params.id]
    );
    return success(res, {}, 'Student updated');
  } catch (err) { return serverError(res, err); }
}

async function remove(req, res) {
  try {
    const { rows } = await pool.query('SELECT user_id FROM students WHERE id=$1', [req.params.id]);
    if (!rows[0]) return notFound(res, 'Student not found');
    await pool.query('UPDATE users SET is_active=FALSE WHERE id=$1', [rows[0].user_id]);
    return success(res, {}, 'Student deactivated');
  } catch (err) { return serverError(res, err); }
}

async function getGrades(req, res) {
  const { term, academic_year, subject_id } = req.query;
  const conditions = [`g.student_id=$1`]; const params = [req.params.id];
  if (term)          conditions.push(`g.term=$${params.push(term)}`);
  if (academic_year) conditions.push(`g.academic_year=$${params.push(academic_year)}`);
  if (subject_id)    conditions.push(`g.subject_id=$${params.push(subject_id)}`);
  try {
    const { rows } = await pool.query(
      `SELECT g.id, g.score, g.letter_grade, g.assessment_type, g.term, g.academic_year,
              sub.name AS subject_name, sub.code AS subject_code
       FROM grades g JOIN subjects sub ON sub.id=g.subject_id
       WHERE ${conditions.join(' AND ')} ORDER BY g.academic_year, g.term, sub.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function getAttendance(req, res) {
  const { subject_id } = req.query;
  const conditions = [`a.student_id=$1`]; const params = [req.params.id];
  if (subject_id) conditions.push(`a.subject_id=$${params.push(subject_id)}`);
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.date, a.status, a.notes, sub.name AS subject_name
       FROM attendance a JOIN subjects sub ON sub.id=a.subject_id
       WHERE ${conditions.join(' AND ')} ORDER BY a.date DESC`, params
    );
    const total = rows.length;
    const present = rows.filter(r=>r.status==='present').length;
    const absent  = rows.filter(r=>r.status==='absent').length;
    const late    = rows.filter(r=>r.status==='late').length;
    const pct = total>0 ? Math.round(present/total*100) : 0;
    return success(res, { summary:{total,present,absent,late,percentage:pct}, records:rows });
  } catch (err) { return serverError(res, err); }
}

async function getReports(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name AS generated_by_name FROM reports r
       LEFT JOIN users u ON u.id=r.generated_by
       WHERE r.student_id=$1 ORDER BY r.academic_year DESC, r.term`, [req.params.id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

module.exports = { list, create, bulkCreate, myChildren, getOne, update, remove, getGrades, getAttendance, getReports };