const { pool } = require('../config/db');
const { success, serverError } = require('../utils/response');

async function overview(req, res) {
  try {
    const [s, t, c, att, pu] = await Promise.all([
      pool.query("SELECT COUNT(*) AS total FROM students s JOIN users u ON u.id = s.user_id WHERE u.is_active = TRUE"),
      pool.query("SELECT COUNT(*) AS total FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.is_active = TRUE"),
      pool.query("SELECT COUNT(*) AS total FROM classes"),
      pool.query(`SELECT ROUND(COUNT(*) FILTER (WHERE status='present')::numeric / NULLIF(COUNT(*),0) * 100, 1) AS pct FROM attendance WHERE date = CURRENT_DATE`),
      pool.query("SELECT COUNT(*) AS total FROM users WHERE is_active = FALSE"),
    ]);
    return success(res, {
      students:         parseInt(s.rows[0].total),
      teachers:         parseInt(t.rows[0].total),
      classes:          parseInt(c.rows[0].total),
      attendance_today: parseFloat(att.rows[0].pct) || 0,
      inactive_users:   parseInt(pu.rows[0].total),
    });
  } catch (err) { return serverError(res, err); }
}

async function attendanceTrend(req, res) {
  const { class_id } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (class_id) conditions.push(`s.class_id = $${params.push(class_id)}`);
  try {
    const { rows } = await pool.query(
      `SELECT a.date,
              ROUND(COUNT(*) FILTER (WHERE a.status='present')::numeric / COUNT(*) * 100, 1) AS pct,
              COUNT(*) AS total
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY a.date ORDER BY a.date ASC LIMIT 60`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function gradeDistribution(req, res) {
  const { class_id, subject_id } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (class_id)   conditions.push(`s.class_id = $${params.push(class_id)}`);
  if (subject_id) conditions.push(`g.subject_id = $${params.push(subject_id)}`);
  try {
    const { rows } = await pool.query(
      `SELECT g.letter_grade AS grade, COUNT(*) AS count
       FROM grades g JOIN students s ON s.id = g.student_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY g.letter_grade
       ORDER BY array_position(ARRAY['A','B+','B','C+','C','D+','D','F'], g.letter_grade)`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function classPerformance(req, res) {
  const { class_id, term, academic_year } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (class_id)      conditions.push(`s.class_id = $${params.push(class_id)}`);
  if (term)          conditions.push(`g.term = $${params.push(term)}`);
  if (academic_year) conditions.push(`g.academic_year = $${params.push(academic_year)}`);
  try {
    const { rows } = await pool.query(
      `SELECT sub.name AS subject, sub.code,
              ROUND(AVG(g.score)::numeric, 1) AS avg_score,
              ROUND(MIN(g.score)::numeric, 1) AS min_score,
              ROUND(MAX(g.score)::numeric, 1) AS max_score,
              COUNT(DISTINCT g.student_id) AS students
       FROM grades g
       JOIN subjects sub ON sub.id = g.subject_id
       JOIN students s   ON s.id = g.student_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY sub.id, sub.name, sub.code
       ORDER BY avg_score DESC`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function studentProgress(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT g.term, g.academic_year,
              ROUND(AVG(g.score)::numeric, 1) AS avg_score,
              COUNT(DISTINCT g.subject_id) AS subjects
       FROM grades g WHERE g.student_id = $1
       GROUP BY g.academic_year, g.term ORDER BY g.academic_year, g.term`,
      [req.params.id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

module.exports = { overview, attendanceTrend, gradeDistribution, classPerformance, studentProgress };
