const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail } = require('../utils/mailer');

function generateAdmissionNumber(year) {
  const yr = (year || '2025/2026').replace('/', '').slice(2);
  return `ADM${yr}${Date.now().toString().slice(-4)}`;
}
function generateStudentNumber(year) {
  const yr = (year || '2025/2026').replace('/', '').slice(2);
  return `STU${yr}${Date.now().toString().slice(-4)}`;
}

// All editable fields (used in create + update)
const ALL_FIELDS = [
  'applicant_name','email','phone','dob','gender','previous_school',
  'class_applied','class_id','academic_year',
  // legacy parent
  'parent_name','parent_phone','parent_email',
  // student info
  'nationality','religion',
  'address_city','address_region','address_postal',
  // father
  'father_name','father_phone','father_email','father_occupation','father_office_addr',
  // mother
  'mother_name','mother_phone','mother_email','mother_occupation','mother_office_addr',
  // previous academic
  'last_class_completed','academic_performance',
  // admission
  'preferred_language','has_sibling','sibling_name_class',
  // medical
  'blood_group','allergies','emergency_contact',
  // documents + declaration
  'documents_submitted','declaration_agreed',
  'notes',
];

// GET /api/admissions
async function list(req, res) {
  const { status, academic_year, search } = req.query;
  const page   = parseInt(req.query.page)  || 1;
  const limit  = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const conditions = []; const params = [];
  if (status)        conditions.push(`a.status = $${params.push(status)}`);
  if (academic_year) conditions.push(`a.academic_year = $${params.push(academic_year)}`);
  if (search)        conditions.push(`a.applicant_name ILIKE $${params.push('%'+search+'%')}`);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.name AS reviewed_by_name,
              c.name AS class_name, c.section AS class_section
       FROM admissions a
       LEFT JOIN users   u ON u.id = a.reviewed_by
       LEFT JOIN classes c ON c.id = a.class_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`, params
    );
    return success(res, { admissions: rows, total: rows.length });
  } catch (err) { return serverError(res, err); }
}

// POST /api/admissions
async function create(req, res) {
  const b = req.body;
  if (!b.applicant_name || (!b.class_applied && !b.class_id))
    return error(res, 'Applicant name and class are required');
  if (!b.declaration_agreed)
    return error(res, 'Declaration must be agreed to before submitting');

  try {
    const admNum = generateAdmissionNumber(b.academic_year);
    const { rows: [r] } = await pool.query(
      `INSERT INTO admissions (
         applicant_name, email, phone, dob, gender, previous_school,
         class_applied, class_id, academic_year,
         parent_name, parent_phone, parent_email,
         nationality, religion,
         address_city, address_region, address_postal,
         father_name, father_phone, father_email, father_occupation, father_office_addr,
         mother_name, mother_phone, mother_email, mother_occupation, mother_office_addr,
         last_class_completed, academic_performance,
         preferred_language, has_sibling, sibling_name_class,
         blood_group, allergies, emergency_contact,
         documents_submitted, declaration_agreed,
         notes, admission_number, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
         $13,$14,$15,$16,$17,
         $18,$19,$20,$21,$22,
         $23,$24,$25,$26,$27,
         $28,$29,$30,$31,$32,
         $33,$34,$35,$36,$37,$38,$39,$40
       ) RETURNING id`,
      [
        b.applicant_name, b.email||null, b.phone||null, b.dob||null,
        b.gender||null, b.previous_school||null,
        b.class_applied||null, b.class_id||null, b.academic_year||'2025/2026',
        b.parent_name||null, b.parent_phone||null, b.parent_email||null,
        b.nationality||null, b.religion||null,
        b.address_city||null, b.address_region||null, b.address_postal||null,
        b.father_name||null, b.father_phone||null, b.father_email||null,
        b.father_occupation||null, b.father_office_addr||null,
        b.mother_name||null, b.mother_phone||null, b.mother_email||null,
        b.mother_occupation||null, b.mother_office_addr||null,
        b.last_class_completed||null, b.academic_performance||null,
        b.preferred_language||null, b.has_sibling||false, b.sibling_name_class||null,
        b.blood_group||null, b.allergies||null, b.emergency_contact||null,
        JSON.stringify(b.documents_submitted||[]), b.declaration_agreed||false,
        b.notes||null, admNum, req.user.id,
      ]
    );
    return created(res, { id: r.id, admission_number: admNum }, 'Application submitted');
  } catch (err) { return serverError(res, err); }
}

// GET /api/admissions/:id
async function getOne(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.name AS reviewed_by_name,
              c.name AS class_name, c.section AS class_section
       FROM admissions a
       LEFT JOIN users   u ON u.id = a.reviewed_by
       LEFT JOIN classes c ON c.id = a.class_id
       WHERE a.id = $1`, [req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Application not found');
    return success(res, rows[0]);
  } catch (err) { return serverError(res, err); }
}

// PUT /api/admissions/:id
async function update(req, res) {
  const updates = []; const params = [];
  ALL_FIELDS.forEach(f => {
    if (req.body[f] !== undefined) updates.push(`${f} = $${params.push(req.body[f])}`);
  });
  if (!updates.length) return error(res, 'No fields to update');
  try {
    await pool.query(
      `UPDATE admissions SET ${updates.join(',')} WHERE id = $${params.push(req.params.id)}`,
      params
    );
    return success(res, {}, 'Application updated');
  } catch (err) { return serverError(res, err); }
}

// POST /api/admissions/:id/approve
async function approve(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM admissions WHERE id=$1', [req.params.id]);
    const app = rows[0];
    if (!app) return notFound(res, 'Application not found');
    if (app.status === 'enrolled') return error(res, 'Already enrolled');

    let classId = app.class_id;
    if (!classId) {
      const { rows: byFull } = await client.query(
        `SELECT id FROM classes WHERE TRIM(CONCAT(name,' ',COALESCE(section,''))) ILIKE $1 LIMIT 1`,
        [app.class_applied?.trim()]
      );
      if (byFull[0]) classId = byFull[0].id;
    }
    if (!classId) {
      const { rows: byName } = await client.query(
        `SELECT id FROM classes WHERE name ILIKE $1 LIMIT 1`, [app.class_applied?.trim()]
      );
      if (byName[0]) classId = byName[0].id;
    }
    if (!classId) {
      await client.query('ROLLBACK');
      return error(res, `Cannot find class "${app.class_applied}". Create it first or edit the application.`);
    }

    const tempPassword = `Edu@${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const hash         = await bcrypt.hash(tempPassword, 12);
    const email        = app.email || `${app.admission_number.toLowerCase()}@educlass.school`;
    const studentNum   = generateStudentNumber(app.academic_year);

    const { rows: [u] } = await client.query(
      `INSERT INTO users (name,email,password_hash,role,force_password_change)
       VALUES ($1,$2,$3,'student',TRUE) RETURNING id`,
      [app.applicant_name, email, hash]
    );
    await client.query(
      `INSERT INTO students (user_id,class_id,student_number,gender,dob,academic_year)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [u.id, classId, studentNum, app.gender||null, app.dob||null, app.academic_year]
    );
    await client.query(
      `UPDATE admissions SET status='enrolled',class_id=$1,reviewed_by=$2,reviewed_at=NOW() WHERE id=$3`,
      [classId, req.user.id, req.params.id]
    );
    await client.query('COMMIT');
    sendWelcomeEmail(email, app.applicant_name, 'student', tempPassword).catch(console.error);
    return success(res, { student_number: studentNum, email, temp_password: tempPassword },
      'Applicant approved and student account created');
  } catch (err) {
    await client.query('ROLLBACK');
    return serverError(res, err);
  } finally { client.release(); }
}

// POST /api/admissions/:id/reject
async function reject(req, res) {
  const { reason } = req.body;
  try {
    await pool.query(
      `UPDATE admissions SET status='rejected', reviewed_by=$1, reviewed_at=NOW(),
       notes = CASE WHEN $2::text IS NOT NULL
               THEN COALESCE(notes||E'\n','') || 'Rejection reason: ' || $2
               ELSE notes END
       WHERE id=$3`,
      [req.user.id, reason||null, req.params.id]
    );
    return success(res, {}, 'Application rejected');
  } catch (err) { return serverError(res, err); }
}

// GET /api/admissions/stats
async function stats(req, res) {
  const { academic_year } = req.query;
  try {
    const yr = academic_year || '2025/2026';
    const { rows: [s] } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='pending')  AS pending,
         COUNT(*) FILTER (WHERE status='approved') AS approved,
         COUNT(*) FILTER (WHERE status='rejected') AS rejected,
         COUNT(*) FILTER (WHERE status='enrolled') AS enrolled,
         COUNT(*) AS total
       FROM admissions WHERE academic_year=$1`, [yr]
    );
    return success(res, s);
  } catch (err) { return serverError(res, err); }
}

module.exports = { list, create, getOne, update, approve, reject, stats };