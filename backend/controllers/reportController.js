const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const { toLetterGrade } = require('../utils/helpers');

// POST /api/reports/generate
// Body: { class_id?, student_id?, term, academic_year }
async function generate(req, res) {
  const { class_id, student_id, term, academic_year } = req.body;
  if (!term || !academic_year) return error(res, 'term and academic_year are required');

  try {
    // Resolve list of student IDs to process
    let studentIds = [];
    if (student_id) {
      studentIds = [student_id];
    } else if (class_id) {
      const [sRows] = await pool.query(
        'SELECT id FROM students WHERE class_id = ?', [class_id]
      );
      studentIds = sRows.map(r => r.id);
    } else {
      return error(res, 'Provide student_id or class_id');
    }

    if (studentIds.length === 0) return error(res, 'No students found');

    const generated = [];

    for (const sid of studentIds) {
      // Average score across all subjects for this term
      const [avgRow] = await pool.query(
        `SELECT ROUND(AVG(score), 2) AS avg, ROUND(SUM(score), 2) AS total
         FROM grades
         WHERE student_id = ? AND term = ? AND academic_year = ?`,
        [sid, term, academic_year]
      );
      const avg   = avgRow[0]?.avg   || 0;
      const total = avgRow[0]?.total || 0;

      // Class size for ranking
      const [sizeRow] = await pool.query(
        'SELECT class_id FROM students WHERE id = ?', [sid]
      );
      const cid = sizeRow[0]?.class_id;

      // Calculate position within class
      const [rankRow] = await pool.query(
        `SELECT COUNT(*) + 1 AS pos
         FROM (
           SELECT g.student_id, AVG(g.score) AS avg
           FROM grades g
           JOIN students s ON s.id = g.student_id
           WHERE s.class_id = ? AND g.term = ? AND g.academic_year = ?
           GROUP BY g.student_id
         ) ranked
         WHERE ranked.avg > ?`,
        [cid, term, academic_year, avg]
      );

      const [sizeCount] = await pool.query(
        `SELECT COUNT(DISTINCT g.student_id) AS n
         FROM grades g JOIN students s ON s.id = g.student_id
         WHERE s.class_id = ? AND g.term = ? AND g.academic_year = ?`,
        [cid, term, academic_year]
      );

      const position  = rankRow[0]?.pos  || null;
      const classSize = sizeCount[0]?.n  || null;

      const remarks = avg >= 80 ? 'Excellent performance. Keep it up!'
                    : avg >= 70 ? 'Good performance. Room to improve.'
                    : avg >= 60 ? 'Average performance. More effort needed.'
                    : avg >= 50 ? 'Below average. Seek teacher support.'
                    : 'Unsatisfactory. Urgent improvement required.';

      await pool.query(
        `INSERT INTO reports
           (student_id, term, academic_year, total_score, average_score, class_position, class_size, remarks, generated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           total_score = VALUES(total_score),
           average_score = VALUES(average_score),
           class_position = VALUES(class_position),
           class_size = VALUES(class_size),
           remarks = VALUES(remarks),
           generated_by = VALUES(generated_by)`,
        [sid, term, academic_year, total, avg, position, classSize, remarks, req.user.id]
      );
      generated.push(sid);
    }

    return created(res, { generated: generated.length }, 'Reports generated');
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/reports/:id
async function getOne(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT r.*,
              u.name AS student_name, s.student_number,
              c.name AS class_name, c.section
       FROM reports r
       JOIN students s ON s.id = r.student_id
       JOIN users u    ON u.id = s.user_id
       JOIN classes c  ON c.id = s.class_id
       WHERE r.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Report not found');

    // Attach per-subject grades for this report period
    const [grades] = await pool.query(
      `SELECT sub.name AS subject, sub.code,
              ROUND(AVG(g.score), 1) AS score, g.letter_grade
       FROM grades g
       JOIN subjects sub ON sub.id = g.subject_id
       WHERE g.student_id = ? AND g.term = ? AND g.academic_year = ?
       GROUP BY sub.id
       ORDER BY sub.name`,
      [rows[0].student_id, rows[0].term, rows[0].academic_year]
    );

    return success(res, { ...rows[0], subjects: grades });
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/reports/student/:studentId
async function byStudent(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM reports WHERE student_id = ? ORDER BY academic_year DESC, term',
      [req.params.studentId]
    );
    return success(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

// GET /api/reports/class/:classId?term=&academic_year=
async function byClass(req, res) {
  const { term, academic_year } = req.query;
  let where = 'WHERE s.class_id = ?';
  const params = [req.params.classId];
  if (term)          { where += ' AND r.term = ?';          params.push(term); }
  if (academic_year) { where += ' AND r.academic_year = ?'; params.push(academic_year); }

  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.term, r.academic_year, r.average_score,
              r.class_position, r.class_size, r.remarks,
              u.name AS student_name, s.student_number
       FROM reports r
       JOIN students s ON s.id = r.student_id
       JOIN users u    ON u.id = s.user_id
       ${where}
       ORDER BY r.class_position`,
      params
    );
    return success(res, rows);
  } catch (err) {
    return serverError(res, err);
  }
}

module.exports = { generate, getOne, byStudent, byClass };
