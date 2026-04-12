const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const { toLetterGrade } = require('../utils/helpers');

async function submit(req, res) {
  const { subject_id, assessment_type, term, academic_year, scores } = req.body;
  if (!Array.isArray(scores) || scores.length === 0) return error(res, 'scores array is required');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const s of scores) {
      const letter = toLetterGrade(s.score);
      await client.query(
        `INSERT INTO grades (student_id, subject_id, score, letter_grade, assessment_type, term, academic_year, entered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [s.student_id, subject_id, s.score, letter, assessment_type, term, academic_year, req.user.id]
      );
    }
    await client.query('COMMIT');
    return created(res, { count: scores.length }, 'Grades submitted');
  } catch (err) { await client.query('ROLLBACK'); return serverError(res, err); }
  finally { client.release(); }
}

async function query(req, res) {
  const { subject_id, term, academic_year, assessment_type } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (subject_id)      conditions.push(`g.subject_id = $${params.push(subject_id)}`);
  if (term)            conditions.push(`g.term = $${params.push(term)}`);
  if (academic_year)   conditions.push(`g.academic_year = $${params.push(academic_year)}`);
  if (assessment_type) conditions.push(`g.assessment_type = $${params.push(assessment_type)}`);
  try {
    const { rows } = await pool.query(
      `SELECT g.id, g.score, g.letter_grade, g.assessment_type, g.term, g.academic_year, g.created_at,
              u.name AS student_name, s.student_number, sub.name AS subject_name
       FROM grades g
       JOIN students s   ON s.id = g.student_id
       JOIN users u      ON u.id = s.user_id
       JOIN subjects sub ON sub.id = g.subject_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.name, g.created_at DESC`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function update(req, res) {
  const { score } = req.body;
  if (score === undefined) return error(res, 'score is required');
  const letter = toLetterGrade(score);
  try {
    const { rowCount } = await pool.query(
      'UPDATE grades SET score = $1, letter_grade = $2 WHERE id = $3', [score, letter, req.params.id]
    );
    if (rowCount === 0) return notFound(res, 'Grade not found');
    return success(res, {}, 'Grade updated');
  } catch (err) { return serverError(res, err); }
}

async function remove(req, res) {
  try {
    const { rowCount } = await pool.query('DELETE FROM grades WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return notFound(res, 'Grade not found');
    return success(res, {}, 'Grade removed');
  } catch (err) { return serverError(res, err); }
}

async function leaderboard(req, res) {
  const { term, academic_year } = req.query;
  const conditions = [`s.class_id = $1`]; const params = [req.params.classId];
  if (term)          conditions.push(`g.term = $${params.push(term)}`);
  if (academic_year) conditions.push(`g.academic_year = $${params.push(academic_year)}`);
  try {
    const { rows } = await pool.query(
      `SELECT u.name AS student_name, s.student_number,
              ROUND(AVG(g.score)::numeric, 1) AS average,
              RANK() OVER (ORDER BY AVG(g.score) DESC) AS position
       FROM grades g
       JOIN students s ON s.id = g.student_id
       JOIN users u    ON u.id = s.user_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY s.id, u.name, s.student_number
       ORDER BY average DESC`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

module.exports = { submit, query, update, remove, leaderboard };
