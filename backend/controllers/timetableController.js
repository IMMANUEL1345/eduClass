const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

async function getClassTimetable(req, res) {
  const { class_id, term, academic_year } = req.query;
  if (!class_id) return error(res, 'class_id required');
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.day_of_week, t.period_number, t.start_time, t.end_time,
              s.name AS subject_name, u.name AS teacher_name
       FROM timetable t
       JOIN subjects s ON s.id = t.subject_id
       JOIN teachers te ON te.id = t.teacher_id
       JOIN users u ON u.id = te.user_id
       WHERE t.class_id = $1
         AND t.term = COALESCE($2, t.term)
         AND t.academic_year = COALESCE($3, t.academic_year)
       ORDER BY
         ARRAY_POSITION(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], t.day_of_week),
         t.period_number`,
      [class_id, term||null, academic_year||null]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function getTeacherTimetable(req, res) {
  const { teacher_id, term, academic_year } = req.query;
  if (!teacher_id) return error(res, 'teacher_id required');
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.day_of_week, t.period_number, t.start_time, t.end_time,
              s.name AS subject_name, c.name AS class_name, c.section
       FROM timetable t
       JOIN subjects s ON s.id = t.subject_id
       JOIN classes c ON c.id = t.class_id
       WHERE t.teacher_id = $1
         AND t.term = COALESCE($2, t.term)
         AND t.academic_year = COALESCE($3, t.academic_year)
       ORDER BY
         ARRAY_POSITION(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'], t.day_of_week),
         t.period_number`,
      [teacher_id, term||null, academic_year||null]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function addEntry(req, res) {
  const { class_id, subject_id, teacher_id, day_of_week, period_number,
          start_time, end_time, term, academic_year } = req.body;
  if (!class_id || !subject_id || !teacher_id || !day_of_week || !period_number)
    return error(res, 'class_id, subject_id, teacher_id, day_of_week and period_number are required');

  try {
    // Check teacher isn't double-booked
    const { rows: clash } = await pool.query(
      `SELECT id FROM timetable
       WHERE teacher_id = $1 AND day_of_week = $2 AND period_number = $3
         AND term = $4 AND academic_year = $5`,
      [teacher_id, day_of_week, period_number, term, academic_year]
    );
    if (clash[0]) return error(res, 'Teacher is already assigned to another class at this time', 409);

    const { rows: [r] } = await pool.query(
      `INSERT INTO timetable
        (class_id,subject_id,teacher_id,day_of_week,period_number,start_time,end_time,term,academic_year)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [class_id, subject_id, teacher_id, day_of_week, period_number,
       start_time||null, end_time||null, term, academic_year]
    );
    return created(res, { id: r.id }, 'Timetable entry added');
  } catch (err) {
    if (err.code === '23505') return error(res, 'This slot is already taken for this class', 409);
    return serverError(res, err);
  }
}

async function updateEntry(req, res) {
  const { teacher_id, start_time, end_time } = req.body;
  try {
    await pool.query(
      `UPDATE timetable SET
         teacher_id = COALESCE($1, teacher_id),
         start_time = COALESCE($2, start_time),
         end_time   = COALESCE($3, end_time)
       WHERE id = $4`,
      [teacher_id||null, start_time||null, end_time||null, req.params.id]
    );
    return success(res, {}, 'Entry updated');
  } catch (err) { return serverError(res, err); }
}

async function removeEntry(req, res) {
  try {
    await pool.query('DELETE FROM timetable WHERE id = $1', [req.params.id]);
    return success(res, {}, 'Entry removed');
  } catch (err) { return serverError(res, err); }
}

// Teacher assignments
async function listAssignments(req, res) {
  const { class_id, term, academic_year } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (class_id)      conditions.push(`ta.class_id = $${params.push(class_id)}`);
  if (term)          conditions.push(`ta.term = $${params.push(term)}`);
  if (academic_year) conditions.push(`ta.academic_year = $${params.push(academic_year)}`);
  try {
    const { rows } = await pool.query(
      `SELECT ta.id, ta.term, ta.academic_year,
              s.name AS subject_name, s.id AS subject_id,
              c.name AS class_name, c.section, c.id AS class_id,
              u.name AS teacher_name, te.id AS teacher_id
       FROM teacher_assignments ta
       JOIN subjects s ON s.id = ta.subject_id
       JOIN classes c ON c.id = ta.class_id
       JOIN teachers te ON te.id = ta.teacher_id
       JOIN users u ON u.id = te.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name, s.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function assign(req, res) {
  const { teacher_id, subject_id, class_id, term, academic_year } = req.body;
  if (!teacher_id || !subject_id || !class_id || !term || !academic_year)
    return error(res, 'teacher_id, subject_id, class_id, term and academic_year are required');
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO teacher_assignments (teacher_id,subject_id,class_id,term,academic_year)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (subject_id,class_id,term,academic_year)
       DO UPDATE SET teacher_id = $1 RETURNING id`,
      [teacher_id, subject_id, class_id, term, academic_year]
    );
    return created(res, { id: r.id }, 'Teacher assigned');
  } catch (err) { return serverError(res, err); }
}

async function removeAssignment(req, res) {
  try {
    await pool.query('DELETE FROM teacher_assignments WHERE id = $1', [req.params.id]);
    return success(res, {}, 'Assignment removed');
  } catch (err) { return serverError(res, err); }
}

module.exports = {
  getClassTimetable, getTeacherTimetable,
  addEntry, updateEntry, removeEntry,
  listAssignments, assign, removeAssignment,
};