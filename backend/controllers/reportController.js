const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');

// ── POST /api/reports/generate ────────────────────────────
async function generate(req, res) {
  const { class_id, student_id, term, academic_year } = req.body;
  if (!term || !academic_year) return error(res, 'term and academic_year are required');

  try {
    let studentIds = [];
    if (student_id) {
      studentIds = [parseInt(student_id)];
    } else if (class_id) {
      const { rows } = await pool.query(
        'SELECT id FROM students WHERE class_id = $1', [class_id]
      );
      studentIds = rows.map(r => r.id);
    } else {
      return error(res, 'Provide student_id or class_id');
    }

    if (studentIds.length === 0) return error(res, 'No students found');

    for (const sid of studentIds) {
      const { rows: avgRows } = await pool.query(
        `SELECT ROUND(AVG(score)::numeric, 2) AS avg,
                ROUND(SUM(score)::numeric, 2) AS total
         FROM grades
         WHERE student_id = $1 AND term = $2 AND academic_year = $3`,
        [sid, term, academic_year]
      );
      const avg   = parseFloat(avgRows[0]?.avg   || 0);
      const total = parseFloat(avgRows[0]?.total || 0);

      const { rows: stuRows } = await pool.query(
        'SELECT class_id FROM students WHERE id = $1', [sid]
      );
      const cid = stuRows[0]?.class_id;

      const { rows: rankRows } = await pool.query(
        `SELECT COUNT(*) + 1 AS pos
         FROM (
           SELECT g.student_id, AVG(g.score) AS avg
           FROM grades g JOIN students s ON s.id = g.student_id
           WHERE s.class_id = $1 AND g.term = $2 AND g.academic_year = $3
           GROUP BY g.student_id
         ) ranked
         WHERE ranked.avg > $4`,
        [cid, term, academic_year, avg]
      );

      const { rows: sizeRows } = await pool.query(
        `SELECT COUNT(DISTINCT g.student_id) AS n
         FROM grades g JOIN students s ON s.id = g.student_id
         WHERE s.class_id = $1 AND g.term = $2 AND g.academic_year = $3`,
        [cid, term, academic_year]
      );

      const position  = parseInt(rankRows[0]?.pos  || 1);
      const classSize = parseInt(sizeRows[0]?.n    || 1);

      const remarks = avg >= 80 ? 'Excellent performance. Keep it up!'
                    : avg >= 70 ? 'Good performance. Room to improve.'
                    : avg >= 60 ? 'Average performance. More effort needed.'
                    : avg >= 50 ? 'Below average. Seek teacher support.'
                    : 'Unsatisfactory. Urgent improvement required.';

      await pool.query(
        `INSERT INTO reports
           (student_id, term, academic_year, total_score, average_score,
            class_position, class_size, remarks, generated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (student_id, term, academic_year)
         DO UPDATE SET
           total_score    = EXCLUDED.total_score,
           average_score  = EXCLUDED.average_score,
           class_position = EXCLUDED.class_position,
           class_size     = EXCLUDED.class_size,
           remarks        = EXCLUDED.remarks,
           generated_by   = EXCLUDED.generated_by`,
        [sid, term, academic_year, total, avg, position, classSize, remarks, req.user.id]
      );
    }

    return created(res, { generated: studentIds.length }, 'Reports generated successfully');
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/reports/:id ──────────────────────────────────
async function getOne(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name AS student_name, s.student_number,
              c.name AS class_name, c.section
       FROM reports r
       JOIN students s ON s.id = r.student_id
       JOIN users u    ON u.id = s.user_id
       JOIN classes c  ON c.id = s.class_id
       WHERE r.id = $1`, [req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Report not found');

    const { rows: grades } = await pool.query(
      `SELECT sub.name AS subject, sub.code,
              ROUND(AVG(g.score)::numeric, 1) AS score,
              g.letter_grade
       FROM grades g JOIN subjects sub ON sub.id = g.subject_id
       WHERE g.student_id = $1 AND g.term = $2 AND g.academic_year = $3
       GROUP BY sub.id, sub.name, sub.code, g.letter_grade
       ORDER BY sub.name`,
      [rows[0].student_id, rows[0].term, rows[0].academic_year]
    );

    return success(res, { ...rows[0], subjects: grades });
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/reports/student/:studentId ──────────────────
async function byStudent(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, c.name AS class_name, c.section
       FROM reports r
       JOIN students s ON s.id = r.student_id
       JOIN classes c  ON c.id = s.class_id
       WHERE r.student_id = $1
       ORDER BY r.academic_year DESC, r.term`,
      [req.params.studentId]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/reports/class/:classId ──────────────────────
async function byClass(req, res) {
  const { term, academic_year } = req.query;
  const conditions = ['s.class_id = $1']; const params = [req.params.classId];
  if (term)          conditions.push(`r.term = $${params.push(term)}`);
  if (academic_year) conditions.push(`r.academic_year = $${params.push(academic_year)}`);
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.term, r.academic_year, r.average_score,
              r.class_position, r.class_size, r.remarks,
              u.name AS student_name, s.student_number
       FROM reports r
       JOIN students s ON s.id = r.student_id
       JOIN users u    ON u.id = s.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.class_position`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/reports/attendance?class_id=&term=&academic_year= ─
async function attendanceReport(req, res) {
  const { class_id, term, academic_year } = req.query;
  if (!class_id) return error(res, 'class_id required');
  const conditions = ['s.class_id = $1']; const params = [class_id];
  if (term)          conditions.push(`a.term = $${params.push(term)}`);
  if (academic_year) conditions.push(`a.academic_year = $${params.push(academic_year)}`);
  try {
    const { rows } = await pool.query(
      `SELECT u.name AS student_name, s.student_number,
              COUNT(*) FILTER (WHERE a.status = 'present')  AS present,
              COUNT(*) FILTER (WHERE a.status = 'absent')   AS absent,
              COUNT(*) FILTER (WHERE a.status = 'late')     AS late,
              COUNT(*) FILTER (WHERE a.status = 'excused')  AS excused,
              COUNT(*) AS total,
              ROUND(
                COUNT(*) FILTER (WHERE a.status = 'present')::numeric
                / NULLIF(COUNT(*), 0) * 100, 1
              ) AS percentage
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       JOIN users u    ON u.id = s.user_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY u.name, s.student_number, s.id
       ORDER BY percentage DESC, u.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/reports/enrollment?class_id=&academic_year= ─
async function enrollmentReport(req, res) {
  const { class_id, academic_year } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (class_id)      conditions.push(`s.class_id = $${params.push(class_id)}`);
  if (academic_year) conditions.push(`s.academic_year = $${params.push(academic_year)}`);
  try {
    const { rows } = await pool.query(
      `SELECT s.student_number, u.name AS student_name,
              s.gender, s.dob, s.academic_year,
              c.name AS class_name, c.section,
              u.email, u.created_at AS enrolled_at
       FROM students s
       JOIN users u   ON u.id = s.user_id
       JOIN classes c ON c.id = s.class_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name, u.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/reports/fee-collection?term=&academic_year= ─
async function feeCollectionReport(req, res) {
  const { term, academic_year } = req.query;
  if (!term || !academic_year) return error(res, 'term and academic_year required');
  try {
    const { rows: byClass } = await pool.query(
      `SELECT c.name AS class_name, c.section,
              COUNT(DISTINCT s.id) AS total_students,
              COALESCE(SUM(fs.amount), 0) AS total_expected,
              COALESCE(SUM(fp.amount_paid), 0) AS total_collected,
              COALESCE(SUM(fs.amount) - SUM(fp.amount_paid), 0) AS outstanding,
              COUNT(DISTINCT CASE WHEN fs.amount <= COALESCE(sub.paid,0) THEN s.id END) AS cleared,
              COUNT(DISTINCT CASE WHEN fs.amount > COALESCE(sub.paid,0) THEN s.id END) AS defaulters
       FROM fee_structures fs
       JOIN students s ON s.class_id = fs.class_id
       JOIN classes c  ON c.id = s.class_id
       LEFT JOIN fee_payments fp ON fp.fee_structure_id = fs.id AND fp.student_id = s.id
       LEFT JOIN (
         SELECT student_id, fee_structure_id, SUM(amount_paid) AS paid
         FROM fee_payments GROUP BY student_id, fee_structure_id
       ) sub ON sub.fee_structure_id = fs.id AND sub.student_id = s.id
       WHERE fs.term = $1 AND fs.academic_year = $2
       GROUP BY c.id, c.name, c.section ORDER BY c.name`,
      [term, academic_year]
    );

    const { rows: [totals] } = await pool.query(
      `SELECT COALESCE(SUM(fs.amount),0) AS total_expected,
              COALESCE(SUM(fp.amount_paid),0) AS total_collected,
              COUNT(DISTINCT s.id) AS total_students
       FROM fee_structures fs
       JOIN students s ON s.class_id = fs.class_id
       LEFT JOIN fee_payments fp ON fp.fee_structure_id = fs.id AND fp.student_id = s.id
       WHERE fs.term = $1 AND fs.academic_year = $2`,
      [term, academic_year]
    );

    return success(res, { by_class: byClass, totals });
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/reports/expense-summary?year= ───────────────
async function expenseSummaryReport(req, res) {
  const year = req.query.year || new Date().getFullYear();
  try {
    const { rows: monthly } = await pool.query(
      `SELECT EXTRACT(MONTH FROM paid_on) AS month,
              TO_CHAR(paid_on, 'Mon') AS month_name,
              SUM(amount) AS total
       FROM expenses
       WHERE EXTRACT(YEAR FROM paid_on) = $1 AND status != 'rejected'
       GROUP BY month, month_name ORDER BY month`, [year]
    );

    const { rows: byCategory } = await pool.query(
      `SELECT category, SUM(amount) AS total, COUNT(*) AS count
       FROM expenses
       WHERE EXTRACT(YEAR FROM paid_on) = $1 AND status != 'rejected'
       GROUP BY category ORDER BY total DESC`, [year]
    );

    const { rows: [summary] } = await pool.query(
      `SELECT SUM(amount) AS total_expenses,
              COUNT(*) AS total_records,
              SUM(CASE WHEN status='approved' THEN amount ELSE 0 END) AS approved,
              SUM(CASE WHEN status='recorded' THEN amount ELSE 0 END) AS pending
       FROM expenses WHERE EXTRACT(YEAR FROM paid_on) = $1`, [year]
    );

    return success(res, { monthly, by_category: byCategory, summary });
  } catch (err) { return serverError(res, err); }
}

module.exports = {
  generate, getOne, byStudent, byClass,
  attendanceReport, enrollmentReport,
  feeCollectionReport, expenseSummaryReport,
};