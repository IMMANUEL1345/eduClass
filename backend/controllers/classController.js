const { pool } = require('../config/db');
const { success, created, notFound, serverError } = require('../utils/response');

async function list(req, res) {
  const { academic_year } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (academic_year) conditions.push(`c.academic_year = $${params.push(academic_year)}`);
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.section, c.academic_year,
              u.name AS homeroom_teacher, COUNT(DISTINCT s.id) AS student_count
       FROM classes c
       LEFT JOIN users u     ON u.id = c.homeroom_teacher_id
       LEFT JOIN students s  ON s.class_id = c.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY c.id, u.name ORDER BY c.academic_year DESC, c.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function create(req, res) {
  const { name, section, academic_year, homeroom_teacher_id } = req.body;
  try {
    const { rows: [r] } = await pool.query(
      'INSERT INTO classes (name,section,academic_year,homeroom_teacher_id) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, section||'A', academic_year, homeroom_teacher_id||null]
    );
    return created(res, { id: r.id }, 'Class created');
  } catch (err) { return serverError(res, err); }
}

async function getOne(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.name AS homeroom_teacher FROM classes c
       LEFT JOIN users u ON u.id = c.homeroom_teacher_id WHERE c.id = $1`, [req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Class not found');
    return success(res, rows[0]);
  } catch (err) { return serverError(res, err); }
}

async function update(req, res) {
  const { name, section, academic_year, homeroom_teacher_id } = req.body;
  try {
    await pool.query(
      `UPDATE classes SET name=COALESCE($1,name), section=COALESCE($2,section),
       academic_year=COALESCE($3,academic_year), homeroom_teacher_id=COALESCE($4,homeroom_teacher_id)
       WHERE id = $5`,
      [name||null, section||null, academic_year||null, homeroom_teacher_id||null, req.params.id]
    );
    return success(res, {}, 'Class updated');
  } catch (err) { return serverError(res, err); }
}

async function remove(req, res) {
  try {
    const { rowCount } = await pool.query('DELETE FROM classes WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return notFound(res, 'Class not found');
    return success(res, {}, 'Class deleted');
  } catch (err) { return serverError(res, err); }
}

async function getStudents(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.student_number, s.dob, s.gender, u.name, u.email
       FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.class_id = $1 AND u.is_active = TRUE ORDER BY u.name`, [req.params.id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function getSubjects(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT sub.id, sub.name, sub.code, sub.periods_per_week, u.name AS teacher_name
       FROM subjects sub LEFT JOIN users u ON u.id = sub.teacher_id
       WHERE sub.class_id = $1 ORDER BY sub.name`, [req.params.id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function listSubjects(req, res) {
  const { class_id, teacher_id } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (class_id)   conditions.push(`sub.class_id = $${params.push(class_id)}`);
  if (teacher_id) conditions.push(`sub.teacher_id = $${params.push(teacher_id)}`);
  try {
    const { rows } = await pool.query(
      `SELECT sub.id, sub.name, sub.code, sub.periods_per_week,
              c.name AS class_name, u.name AS teacher_name
       FROM subjects sub JOIN classes c ON c.id = sub.class_id LEFT JOIN users u ON u.id = sub.teacher_id
       WHERE ${conditions.join(' AND ')} ORDER BY c.name, sub.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function createSubject(req, res) {
  const { name, code, class_id, teacher_id, periods_per_week } = req.body;
  try {
    const { rows: [r] } = await pool.query(
      'INSERT INTO subjects (name,code,class_id,teacher_id,periods_per_week) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [name, code||null, class_id, teacher_id||null, periods_per_week||5]
    );
    return created(res, { id: r.id }, 'Subject created');
  } catch (err) { return serverError(res, err); }
}

async function updateSubject(req, res) {
  const { name, code, teacher_id, periods_per_week } = req.body;
  try {
    await pool.query(
      `UPDATE subjects SET name=COALESCE($1,name), code=COALESCE($2,code),
       teacher_id=COALESCE($3,teacher_id), periods_per_week=COALESCE($4,periods_per_week)
       WHERE id = $5`,
      [name||null, code||null, teacher_id||null, periods_per_week||null, req.params.id]
    );
    return success(res, {}, 'Subject updated');
  } catch (err) { return serverError(res, err); }
}

async function removeSubject(req, res) {
  try {
    const { rowCount } = await pool.query('DELETE FROM subjects WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return notFound(res, 'Subject not found');
    return success(res, {}, 'Subject removed');
  } catch (err) { return serverError(res, err); }
}

module.exports = { list, create, getOne, update, remove, getStudents, getSubjects, listSubjects, createSubject, updateSubject, removeSubject };
