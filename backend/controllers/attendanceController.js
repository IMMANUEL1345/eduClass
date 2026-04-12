const { pool } = require('../config/db');
const { success, created, error, serverError } = require('../utils/response');
const { sendAbsenceAlert } = require('../utils/mailer');

async function mark(req, res) {
  const { subject_id, date, records } = req.body;
  if (!Array.isArray(records) || records.length === 0) return error(res, 'records array is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const rec of records) {
      await client.query(
        `INSERT INTO attendance (student_id, subject_id, date, status, marked_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (student_id, subject_id, date)
         DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes`,
        [rec.student_id, subject_id, date, rec.status, req.user.id, rec.notes || null]
      );
    }
    await client.query('COMMIT');
    const absentIds = records.filter(r => r.status === 'absent').map(r => r.student_id);
    if (absentIds.length > 0) sendAbsenceNotifications(absentIds, subject_id, date).catch(console.error);
    return created(res, { marked: records.length }, 'Attendance saved');
  } catch (err) { await client.query('ROLLBACK'); return serverError(res, err); }
  finally { client.release(); }
}

async function sendAbsenceNotifications(studentIds, subjectId, date) {
  const { rows: subRows } = await pool.query('SELECT name FROM subjects WHERE id = $1', [subjectId]);
  const subjectName = subRows[0]?.name || 'Unknown subject';
  for (const sid of studentIds) {
    const { rows } = await pool.query(
      `SELECT u.email, u.name AS parent_name, su.name AS student_name
       FROM parent_student ps
       JOIN parents p  ON p.id = ps.parent_id
       JOIN users u    ON u.id = p.user_id
       JOIN students s ON s.id = ps.student_id
       JOIN users su   ON su.id = s.user_id
       WHERE ps.student_id = $1`, [sid]
    );
    for (const p of rows) await sendAbsenceAlert(p.email, p.parent_name, p.student_name, date, [subjectName]);
  }
}

async function query(req, res) {
  const { class_id, date, subject_id } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (class_id)   { conditions.push(`s.class_id = $${params.push(class_id)}`); }
  if (date)       { conditions.push(`a.date = $${params.push(date)}`); }
  if (subject_id) { conditions.push(`a.subject_id = $${params.push(subject_id)}`); }

  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.date, a.status, a.notes,
              u.name AS student_name, s.student_number,
              sub.name AS subject_name, c.name AS class_name
       FROM attendance a
       JOIN students s   ON s.id = a.student_id
       JOIN users u      ON u.id = s.user_id
       JOIN subjects sub ON sub.id = a.subject_id
       JOIN classes c    ON c.id = s.class_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.date DESC, u.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function update(req, res) {
  const { status, notes } = req.body;
  try {
    await pool.query(
      'UPDATE attendance SET status = COALESCE($1, status), notes = COALESCE($2, notes) WHERE id = $3',
      [status || null, notes || null, req.params.id]
    );
    return success(res, {}, 'Attendance updated');
  } catch (err) { return serverError(res, err); }
}

async function summary(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT sub.name AS subject,
              COUNT(*) FILTER (WHERE a.status = 'present') AS present,
              COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent,
              COUNT(*) FILTER (WHERE a.status = 'late')    AS late,
              COUNT(*) AS total,
              ROUND(COUNT(*) FILTER (WHERE a.status = 'present')::numeric / COUNT(*) * 100, 1) AS pct
       FROM attendance a
       JOIN subjects sub ON sub.id = a.subject_id
       WHERE a.student_id = $1
       GROUP BY sub.id, sub.name ORDER BY sub.name`,
      [req.params.studentId]
    );
    const overall = rows.length
      ? Math.round(rows.reduce((a, r) => a + parseInt(r.present), 0) /
                   rows.reduce((a, r) => a + parseInt(r.total), 0) * 100)
      : 0;
    return success(res, { overall, by_subject: rows });
  } catch (err) { return serverError(res, err); }
}

async function absentees(req, res) {
  const { date } = req.query;
  if (!date) return error(res, 'date query param required');
  try {
    const { rows } = await pool.query(
      `SELECT u.name AS student_name, s.student_number,
              c.name AS class_name, sub.name AS subject_name
       FROM attendance a
       JOIN students s   ON s.id = a.student_id
       JOIN users u      ON u.id = s.user_id
       JOIN classes c    ON c.id = s.class_id
       JOIN subjects sub ON sub.id = a.subject_id
       WHERE a.date = $1 AND a.status = 'absent'
       ORDER BY c.name, u.name`, [date]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

module.exports = { mark, query, update, summary, absentees };
