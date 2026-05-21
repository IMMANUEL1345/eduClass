const { pool }     = require('../config/db');
const cloudinary   = require('../config/cloudinary');
const { success, created, error, notFound, serverError } = require('../utils/response');

const CATEGORIES = [
  'Misconduct','Bullying','Violence','Insubordination',
  'Academic Dishonesty','Harassment','Lateness / Truancy',
  'Vandalism','Substance Abuse','Cyberbullying','Other'
];
const STATUSES = ['open','under_review','resolved','dismissed'];

function getFileType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'document';
}

function getCloudinaryResourceType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'video'; // Cloudinary uses 'video' for audio
  return 'raw';
}

async function uploadFile(buffer, mimetype) {
  const resourceType = getCloudinaryResourceType(mimetype);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'educlass/incidents', resource_type: resourceType },
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });
}

// GET /api/incidents/search-subjects?q=&type=
async function searchSubjects(req, res) {
  const { q = '', type } = req.query;
  const role = req.user.role;
  try {
    let roleFilter = '';
    // Parents can only report students
    if (role === 'parent') roleFilter = `AND u.role = 'student'`;
    else if (type === 'student') roleFilter = `AND u.role = 'student'`;
    else if (type === 'teacher') roleFilter = `AND u.role = 'teacher'`;

    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.role,
              COALESCE(c.name || COALESCE(' ' || c.section,''), '') AS class_name
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN classes  c ON c.id = s.class_id
       WHERE u.is_active = TRUE
         AND u.id != $1
         AND u.name ILIKE $2
         ${roleFilter}
       ORDER BY u.name
       LIMIT 20`,
      [req.user.id, `%${q}%`]
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// GET /api/incidents
async function list(req, res) {
  const { status, severity, category, subject_type } = req.query;
  const role = req.user.role;
  const uid  = req.user.id;

  let where = 'WHERE TRUE';
  const params = [];

  if (status)       where += ` AND ir.status = $${params.push(status)}`;
  if (severity)     where += ` AND ir.severity = $${params.push(severity)}`;
  if (category)     where += ` AND ir.category = $${params.push(category)}`;
  if (subject_type) where += ` AND ir.subject_type = $${params.push(subject_type)}`;

  // Role-based visibility
  if (['admin','headmaster'].includes(role)) {
    // See everything — no extra filter
  } else if (role === 'teacher') {
    // Filed by them, or about them, or about students they teach
    where += ` AND (
      ir.reporter_id = $${params.push(uid)}
      OR ir.subject_id = $${params.push(uid)}
      OR ir.subject_id IN (
        SELECT s.user_id FROM students s
        JOIN subject_teacher_assignments sta
          ON sta.class_id = s.class_id AND sta.teacher_id = $${params.push(uid)}
      )
    )`;
  } else if (role === 'parent') {
    where += ` AND ir.reporter_id = $${params.push(uid)}`;
  } else {
    // student: filed by them OR about them
    where += ` AND (ir.reporter_id = $${params.push(uid)} OR ir.subject_id = $${params.push(uid)})`;
  }

  try {
    const { rows } = await pool.query(
      `SELECT ir.id, ir.category, ir.severity, ir.status,
              ir.incident_date, ir.created_at, ir.subject_type,
              reporter.name AS reporter_name, reporter.role AS reporter_role,
              subject.name  AS subject_name,  subject.role  AS subject_role,
              (SELECT COUNT(*) FROM incident_attachments ia WHERE ia.report_id = ir.id) AS attachment_count
       FROM incident_reports ir
       JOIN users reporter ON reporter.id = ir.reporter_id
       JOIN users subject  ON subject.id  = ir.subject_id
       ${where}
       ORDER BY ir.created_at DESC`,
      params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// POST /api/incidents  (multipart/form-data)
async function create(req, res) {
  const { subject_id, category, severity, description, incident_date } = req.body;
  const files = req.files || [];

  if (!subject_id)          return error(res, 'Subject is required');
  if (!category)            return error(res, 'Category is required');
  if (!description?.trim()) return error(res, 'Description is required');
  if (!incident_date)       return error(res, 'Incident date is required');

  try {
    // Get subject
    const { rows: [subject] } = await pool.query(
      'SELECT id, name, role FROM users WHERE id=$1', [subject_id]
    );
    if (!subject) return error(res, 'Subject user not found');

    // Permission check
    const role = req.user.role;
    if (role === 'parent' && subject.role !== 'student')
      return error(res, 'Parents can only file reports against students');
    if (parseInt(subject_id) === req.user.id)
      return error(res, 'You cannot file a report against yourself');

    // Create report
    const { rows: [report] } = await pool.query(
      `INSERT INTO incident_reports
        (reporter_id, subject_id, subject_type, category, severity, description, incident_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.user.id, subject_id, subject.role, category,
       severity || 'medium', description.trim(), incident_date]
    );

    // Upload attachments
    for (const file of files) {
      try {
        const result = await uploadFile(file.buffer, file.mimetype);
        await pool.query(
          `INSERT INTO incident_attachments
            (report_id, file_url, file_type, file_name, file_size, public_id)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [report.id, result.secure_url, getFileType(file.mimetype),
           file.originalname, file.size, result.public_id]
        );
      } catch (uploadErr) {
        console.error('Attachment upload failed:', uploadErr.message);
      }
    }

    // Notify admins + headmaster
    const { rows: admins } = await pool.query(
      `SELECT id FROM users WHERE role IN ('admin','headmaster') AND is_active = TRUE`
    );
    const notifBody = `${req.user.name} filed a ${severity || 'medium'} severity "${category}" report against ${subject.name}`;
    for (const admin of admins) {
      if (admin.id === req.user.id) continue;
      await pool.query(
        `INSERT INTO notifications (user_id,type,title,body) VALUES ($1,'incident',$2,$3)`,
        [admin.id, '🚩 New incident report filed', notifBody]
      ).catch(() => {});
    }

    return created(res, { id: report.id }, 'Report filed successfully');
  } catch (err) { return serverError(res, err); }
}

// GET /api/incidents/:id
async function getOne(req, res) {
  try {
    const { rows: [report] } = await pool.query(
      `SELECT ir.*,
              reporter.name AS reporter_name, reporter.role AS reporter_role,
              subject.name  AS subject_name,  subject.role  AS subject_role,
              actioner.name AS actioned_by_name
       FROM incident_reports ir
       JOIN users reporter ON reporter.id = ir.reporter_id
       JOIN users subject  ON subject.id  = ir.subject_id
       LEFT JOIN users actioner ON actioner.id = ir.actioned_by
       WHERE ir.id = $1`, [req.params.id]
    );
    if (!report) return notFound(res, 'Report not found');

    // Access check
    const role = req.user.role;
    const uid  = req.user.id;
    const allowed = ['admin','headmaster'].includes(role)
      || report.reporter_id === uid
      || report.subject_id  === uid
      || role === 'teacher';
    if (!allowed) return error(res, 'Access denied', 403);

    const { rows: attachments } = await pool.query(
      `SELECT id, file_url, file_type, file_name, file_size, created_at
       FROM incident_attachments WHERE report_id=$1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    return success(res, { ...report, attachments });
  } catch (err) { return serverError(res, err); }
}

// PUT /api/incidents/:id/status
async function updateStatus(req, res) {
  const { status, action_taken } = req.body;
  if (!STATUSES.includes(status)) return error(res, 'Invalid status');
  if (!['admin','headmaster','teacher'].includes(req.user.role))
    return error(res, 'Not authorised', 403);

  try {
    await pool.query(
      `UPDATE incident_reports
       SET status=$1, action_taken=$2, actioned_by=$3, actioned_at=NOW(), updated_at=NOW()
       WHERE id=$4`,
      [status, action_taken || null, req.user.id, req.params.id]
    );
    // Notify reporter
    const { rows: [r] } = await pool.query(
      'SELECT reporter_id, category FROM incident_reports WHERE id=$1', [req.params.id]
    );
    if (r) {
      await pool.query(
        `INSERT INTO notifications (user_id,type,title,body) VALUES ($1,'incident',$2,$3)`,
        [r.reporter_id,
         `Report status updated: ${status.replace('_',' ')}`,
         `Your "${r.category}" report status changed to "${status.replace('_',' ')}"${action_taken ? `. Action: ${action_taken}` : '.'}`]
      ).catch(() => {});
    }
    return success(res, {}, 'Status updated');
  } catch (err) { return serverError(res, err); }
}

// DELETE /api/incidents/:id
async function remove(req, res) {
  try {
    const { rows: [report] } = await pool.query(
      'SELECT reporter_id FROM incident_reports WHERE id=$1', [req.params.id]
    );
    if (!report) return notFound(res, 'Report not found');

    const canDelete = ['admin','headmaster'].includes(req.user.role)
      || report.reporter_id === req.user.id;
    if (!canDelete) return error(res, 'Not authorised', 403);

    // Clean up Cloudinary files
    const { rows: atts } = await pool.query(
      'SELECT public_id, file_type FROM incident_attachments WHERE report_id=$1',
      [req.params.id]
    );
    for (const att of atts) {
      if (!att.public_id) continue;
      const rt = att.file_type === 'image' ? 'image' : att.file_type === 'document' ? 'raw' : 'video';
      await cloudinary.uploader.destroy(att.public_id, { resource_type: rt }).catch(() => {});
    }

    await pool.query('DELETE FROM incident_reports WHERE id=$1', [req.params.id]);
    return success(res, {}, 'Report deleted');
  } catch (err) { return serverError(res, err); }
}

module.exports = { list, create, getOne, updateStatus, remove, searchSubjects };