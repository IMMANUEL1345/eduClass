const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');

// ── GET /api/assignments ──────────────────────────────────
async function list(req, res) {
  const { class_id, term, academic_year, status } = req.query;
  const conditions = ['TRUE']; const params = [];

  if (class_id)      conditions.push(`a.class_id = $${params.push(class_id)}`);
  if (term)          conditions.push(`a.term = $${params.push(term)}`);
  if (academic_year) conditions.push(`a.academic_year = $${params.push(academic_year)}`);
  if (status)        conditions.push(`a.status = $${params.push(status)}`);

  // Teachers only see their own
  if (req.user.role === 'teacher') {
    conditions.push(`a.teacher_id = $${params.push(req.user.id)}`);
  }

  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.description, a.due_date, a.due_time,
              a.max_score, a.status, a.term, a.academic_year, a.created_at,
              c.name AS class_name, c.section,
              s.name AS subject_name,
              u.name AS teacher_name,
              COUNT(sub.id) AS submission_count
       FROM assignments a
       JOIN classes c ON c.id = a.class_id
       LEFT JOIN subjects s ON s.id = a.subject_id
       JOIN users u ON u.id = a.teacher_id
       LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY a.id, c.name, c.section, s.name, u.name
       ORDER BY a.due_date ASC, a.created_at DESC`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/assignments/my — student's own assignments ───
async function myAssignments(req, res) {
  try {
    const { rows: [student] } = await pool.query(
      'SELECT id, class_id FROM students WHERE user_id = $1', [req.user.id]
    );
    if (!student) return success(res, []);

    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.description, a.due_date, a.due_time,
              a.max_score, a.status, a.term, a.academic_year, a.created_at,
              c.name AS class_name, c.section,
              s.name AS subject_name,
              u.name AS teacher_name,
              sub.id AS submission_id,
              sub.submission_text, sub.submitted_at,
              sub.score, sub.feedback, sub.status AS submission_status
       FROM assignments a
       JOIN classes c ON c.id = a.class_id
       LEFT JOIN subjects s ON s.id = a.subject_id
       JOIN users u ON u.id = a.teacher_id
       LEFT JOIN assignment_submissions sub
         ON sub.assignment_id = a.id AND sub.student_id = $1
       WHERE a.class_id = $2 AND a.status != 'draft'
       ORDER BY a.due_date ASC`, [student.id, student.class_id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/assignments/child/:studentId — parent view ──
async function childAssignments(req, res) {
  const { studentId } = req.params;
  try {
    const { rows: [student] } = await pool.query(
      'SELECT id, class_id FROM students WHERE id = $1', [studentId]
    );
    if (!student) return success(res, []);

    const { rows } = await pool.query(
      `SELECT a.id, a.title, a.description, a.due_date, a.due_time,
              a.max_score, a.status, a.term, a.academic_year,
              c.name AS class_name, c.section,
              s.name AS subject_name,
              u.name AS teacher_name,
              sub.id AS submission_id,
              sub.submitted_at, sub.score, sub.feedback,
              sub.status AS submission_status
       FROM assignments a
       JOIN classes c ON c.id = a.class_id
       LEFT JOIN subjects s ON s.id = a.subject_id
       JOIN users u ON u.id = a.teacher_id
       LEFT JOIN assignment_submissions sub
         ON sub.assignment_id = a.id AND sub.student_id = $1
       WHERE a.class_id = $2 AND a.status != 'draft'
       ORDER BY a.due_date ASC`, [student.id, student.class_id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/assignments/:id ──────────────────────────────
async function getOne(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, c.name AS class_name, c.section,
              s.name AS subject_name, u.name AS teacher_name
       FROM assignments a
       JOIN classes c ON c.id = a.class_id
       LEFT JOIN subjects s ON s.id = a.subject_id
       JOIN users u ON u.id = a.teacher_id
       WHERE a.id = $1`, [req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Assignment not found');
    return success(res, rows[0]);
  } catch (err) { return serverError(res, err); }
}

// ── POST /api/assignments ─────────────────────────────────
async function create(req, res) {
  const { title, description, class_id, subject_id, due_date,
          due_time, term, academic_year, max_score, status } = req.body;
  if (!title || !class_id || !due_date || !term || !academic_year)
    return error(res, 'Title, class, due date, term and academic year required');
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO assignments
        (title,description,class_id,subject_id,teacher_id,
         due_date,due_time,term,academic_year,max_score,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [title, description||null, class_id, subject_id||null, req.user.id,
       due_date, due_time||'23:59:00', term, academic_year,
       max_score||100, status||'active']
    );

    // Notify all students in the class
    const { rows: students } = await pool.query(
      `SELECT s.user_id FROM students s WHERE s.class_id = $1`, [class_id]
    );
    for (const s of students) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body)
         VALUES ($1, 'assignment', $2, $3)`,
        [s.user_id, `New assignment: ${title}`,
         `Due: ${new Date(due_date).toLocaleDateString('en-GB')} at ${due_time||'23:59'}`]
      ).catch(() => {});
    }

    return created(res, { id: r.id }, 'Assignment created');
  } catch (err) { return serverError(res, err); }
}

// ── PUT /api/assignments/:id ──────────────────────────────
async function update(req, res) {
  const { title, description, due_date, due_time, max_score, status } = req.body;
  try {
    await pool.query(
      `UPDATE assignments SET
         title       = COALESCE($1, title),
         description = COALESCE($2, description),
         due_date    = COALESCE($3, due_date),
         due_time    = COALESCE($4, due_time),
         max_score   = COALESCE($5, max_score),
         status      = COALESCE($6, status)
       WHERE id = $7 AND teacher_id = $8`,
      [title||null, description||null, due_date||null,
       due_time||null, max_score||null, status||null,
       req.params.id, req.user.id]
    );
    return success(res, {}, 'Assignment updated');
  } catch (err) { return serverError(res, err); }
}

// ── DELETE /api/assignments/:id ───────────────────────────
async function remove(req, res) {
  try {
    await pool.query(
      'DELETE FROM assignments WHERE id=$1 AND teacher_id=$2',
      [req.params.id, req.user.id]
    );
    return success(res, {}, 'Assignment deleted');
  } catch (err) { return serverError(res, err); }
}

// ── GET /api/assignments/:id/submissions ─────────────────
async function getSubmissions(req, res) {
  try {
    // Get all students in the class for this assignment
    const { rows: [assignment] } = await pool.query(
      'SELECT class_id FROM assignments WHERE id=$1', [req.params.id]
    );
    if (!assignment) return notFound(res, 'Assignment not found');

    const { rows } = await pool.query(
      `SELECT s.id AS student_id, u.name AS student_name, s.student_number,
              sub.id AS submission_id, sub.submission_text,
              sub.submitted_at, sub.score, sub.feedback, sub.status AS submission_status
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN assignment_submissions sub
         ON sub.assignment_id = $1 AND sub.student_id = s.id
       WHERE s.class_id = $2
       ORDER BY u.name`, [req.params.id, assignment.class_id]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── POST /api/assignments/:id/submit — student submits ────
async function submit(req, res) {
  const { submission_text } = req.body;
  if (!submission_text?.trim()) return error(res, 'Submission text is required');
  try {
    const { rows: [student] } = await pool.query(
      'SELECT id FROM students WHERE user_id=$1', [req.user.id]
    );
    if (!student) return error(res, 'Student record not found');

    // Check if past deadline
    const { rows: [asmt] } = await pool.query(
      `SELECT due_date, due_time, teacher_id, title FROM assignments WHERE id=$1`, [req.params.id]
    );
    if (!asmt) return notFound(res, 'Assignment not found');

    const deadline = new Date(`${asmt.due_date.toISOString().split('T')[0]}T${asmt.due_time}`);
    const isLate   = new Date() > deadline;
    const status   = isLate ? 'late' : 'submitted';

    const { rows: [r] } = await pool.query(
      `INSERT INTO assignment_submissions
        (assignment_id, student_id, submission_text, status)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (assignment_id, student_id)
       DO UPDATE SET submission_text=$3, submitted_at=NOW(), status=$4
       RETURNING id`,
      [req.params.id, student.id, submission_text, status]
    );

    // Notify teacher
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body)
       VALUES ($1, 'submission', $2, $3)`,
      [asmt.teacher_id,
       `New submission: ${asmt.title}`,
       `${req.user.name} submitted${isLate ? ' (late)' : ''}`]
    ).catch(() => {});

    return created(res, { id: r.id, status, is_late: isLate },
      isLate ? 'Submitted late' : 'Submitted successfully');
  } catch (err) { return serverError(res, err); }
}

// ── PUT /api/assignments/:id/submissions/:subId/grade ─────
async function grade(req, res) {
  const { score, feedback } = req.body;
  if (score === undefined) return error(res, 'Score is required');
  try {
    await pool.query(
      `UPDATE assignment_submissions
       SET score=$1, feedback=$2, status='graded'
       WHERE id=$3 AND assignment_id=$4`,
      [score, feedback||null, req.params.subId, req.params.id]
    );

    // Notify student
    const { rows: [sub] } = await pool.query(
      `SELECT sub.student_id, s.user_id, a.title
       FROM assignment_submissions sub
       JOIN students s ON s.id = sub.student_id
       JOIN assignments a ON a.id = sub.assignment_id
       WHERE sub.id=$1`, [req.params.subId]
    );
    if (sub) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body)
         VALUES ($1, 'grade', $2, $3)`,
        [sub.user_id, `Assignment graded: ${sub.title}`,
         `Your submission has been graded. Score: ${score}`]
      ).catch(() => {});
    }

    return success(res, {}, 'Submission graded');
  } catch (err) { return serverError(res, err); }
}

module.exports = {
  list, myAssignments, childAssignments,
  getOne, create, update, remove,
  getSubmissions, submit, grade,
};