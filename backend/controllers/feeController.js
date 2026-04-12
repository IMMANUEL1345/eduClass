const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const { paginate } = require('../utils/helpers');

// ── FEE STRUCTURES ────────────────────────────────────────

// GET /api/fees/structures
async function listStructures(req, res) {
  const { academic_year, class_id } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (academic_year) conditions.push(`fs.academic_year = $${params.push(academic_year)}`);
  if (class_id)      conditions.push(`fs.class_id = $${params.push(class_id)}`);
  try {
    const { rows } = await pool.query(
      `SELECT fs.id, fs.term, fs.academic_year, fs.amount, fs.description,
              c.name AS class_name, c.section,
              u.name AS created_by
       FROM fee_structures fs
       JOIN classes c ON c.id = fs.class_id
       JOIN users u   ON u.id = fs.created_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY fs.academic_year DESC, c.name, fs.term`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// POST /api/fees/structures
async function createStructure(req, res) {
  const { class_id, term, academic_year, amount, description } = req.body;
  if (!class_id || !term || !academic_year || !amount) {
    return error(res, 'class_id, term, academic_year and amount are required');
  }
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO fee_structures (class_id, term, academic_year, amount, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [class_id, term, academic_year, amount, description || 'School fees', req.user.id]
    );
    return created(res, { id: r.id }, 'Fee structure created');
  } catch (err) {
    if (err.code === '23505') return error(res, 'Fee structure already exists for this class/term/year', 409);
    return serverError(res, err);
  }
}

// PUT /api/fees/structures/:id
async function updateStructure(req, res) {
  const { amount, description } = req.body;
  try {
    const { rowCount } = await pool.query(
      'UPDATE fee_structures SET amount = COALESCE($1,amount), description = COALESCE($2,description) WHERE id = $3',
      [amount || null, description || null, req.params.id]
    );
    if (rowCount === 0) return notFound(res, 'Fee structure not found');
    return success(res, {}, 'Fee structure updated');
  } catch (err) { return serverError(res, err); }
}

// ── FEE PAYMENTS ─────────────────────────────────────────

// GET /api/fees/payments?student_id=&class_id=&term=&academic_year=
async function listPayments(req, res) {
  const { student_id, class_id, term, academic_year } = req.query;
  const { limit, offset } = paginate(req.query);
  const conditions = ['TRUE']; const params = [];
  if (student_id)    conditions.push(`fp.student_id = $${params.push(student_id)}`);
  if (class_id)      conditions.push(`s.class_id = $${params.push(class_id)}`);
  if (term)          conditions.push(`fs.term = $${params.push(term)}`);
  if (academic_year) conditions.push(`fs.academic_year = $${params.push(academic_year)}`);
  try {
    const { rows } = await pool.query(
      `SELECT fp.id, fp.amount_paid, fp.payment_method, fp.reference, fp.paid_at, fp.notes,
              u.name AS student_name, s.student_number,
              c.name AS class_name, c.section,
              fs.term, fs.academic_year, fs.amount AS fee_amount,
              ur.name AS received_by
       FROM fee_payments fp
       JOIN students s         ON s.id = fp.student_id
       JOIN users u            ON u.id = s.user_id
       JOIN classes c          ON c.id = s.class_id
       JOIN fee_structures fs  ON fs.id = fp.fee_structure_id
       JOIN users ur           ON ur.id = fp.received_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY fp.created_at DESC
       LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// POST /api/fees/payments  — record a fee payment
async function recordPayment(req, res) {
  const { student_id, fee_structure_id, amount_paid, payment_method, reference, paid_at, notes } = req.body;
  if (!student_id || !fee_structure_id || !amount_paid) {
    return error(res, 'student_id, fee_structure_id and amount_paid are required');
  }
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO fee_payments (student_id, fee_structure_id, amount_paid, payment_method, reference, paid_at, received_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [student_id, fee_structure_id, amount_paid, payment_method || 'cash', reference || null,
       paid_at || new Date().toISOString().split('T')[0], req.user.id, notes || null]
    );

    // Notify parent
    const { rows: parents } = await pool.query(
      `SELECT u.id FROM parent_student ps
       JOIN parents p ON p.id = ps.parent_id
       JOIN users u   ON u.id = p.user_id
       WHERE ps.student_id = $1`, [student_id]
    );
    for (const p of parents) {
      await pool.query(
        'INSERT INTO notifications (user_id,type,title,body) VALUES ($1,$2,$3,$4)',
        [p.id, 'payment', 'Fee payment received',
         `A fee payment of GH₵${parseFloat(amount_paid).toFixed(2)} has been recorded for your ward.`]
      );
    }

    return created(res, { id: r.id }, 'Payment recorded');
  } catch (err) { return serverError(res, err); }
}

// GET /api/fees/balance/:studentId?term=&academic_year=
// Returns what a student owes, what they've paid, and balance
async function studentBalance(req, res) {
  const { term, academic_year } = req.query;
  const conditions = [`s.id = $1`]; const params = [req.params.studentId];
  if (term)          conditions.push(`fs.term = $${params.push(term)}`);
  if (academic_year) conditions.push(`fs.academic_year = $${params.push(academic_year)}`);

  try {
    const { rows } = await pool.query(
      `SELECT fs.id AS fee_structure_id, fs.term, fs.academic_year,
              fs.amount AS total_fee,
              COALESCE(SUM(fp.amount_paid), 0) AS amount_paid,
              fs.amount - COALESCE(SUM(fp.amount_paid), 0) AS balance,
              CASE WHEN fs.amount <= COALESCE(SUM(fp.amount_paid), 0)
                   THEN TRUE ELSE FALSE END AS is_cleared
       FROM fee_structures fs
       JOIN students s ON s.class_id = fs.class_id
       LEFT JOIN fee_payments fp
         ON fp.fee_structure_id = fs.id AND fp.student_id = s.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY fs.id, fs.term, fs.academic_year, fs.amount, s.id
       ORDER BY fs.academic_year, fs.term`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// GET /api/fees/defaulters?class_id=&term=&academic_year=
// Students who have not fully paid
async function defaulters(req, res) {
  const { class_id, term, academic_year } = req.query;
  if (!term || !academic_year) return error(res, 'term and academic_year are required');

  const conditions = [`fs.term = $1`, `fs.academic_year = $2`];
  const params = [term, academic_year];
  if (class_id) conditions.push(`s.class_id = $${params.push(class_id)}`);

  try {
    const { rows } = await pool.query(
      `SELECT u.name AS student_name, s.student_number, s.id AS student_id,
              c.name AS class_name, c.section,
              fs.amount AS total_fee,
              COALESCE(SUM(fp.amount_paid), 0) AS amount_paid,
              fs.amount - COALESCE(SUM(fp.amount_paid), 0) AS balance
       FROM fee_structures fs
       JOIN students s ON s.class_id = fs.class_id
       JOIN users u    ON u.id = s.user_id
       JOIN classes c  ON c.id = s.class_id
       LEFT JOIN fee_payments fp
         ON fp.fee_structure_id = fs.id AND fp.student_id = s.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY u.name, s.student_number, s.id, c.name, c.section, fs.amount
       HAVING fs.amount > COALESCE(SUM(fp.amount_paid), 0)
       ORDER BY balance DESC, c.name, u.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// GET /api/fees/cleared?class_id=&term=&academic_year=
// Students who have fully paid
async function cleared(req, res) {
  const { class_id, term, academic_year } = req.query;
  if (!term || !academic_year) return error(res, 'term and academic_year are required');
  const conditions = [`fs.term = $1`, `fs.academic_year = $2`];
  const params = [term, academic_year];
  if (class_id) conditions.push(`s.class_id = $${params.push(class_id)}`);

  try {
    const { rows } = await pool.query(
      `SELECT u.name AS student_name, s.student_number, s.id AS student_id,
              c.name AS class_name, c.section,
              fs.amount AS total_fee,
              SUM(fp.amount_paid) AS amount_paid
       FROM fee_structures fs
       JOIN students s ON s.class_id = fs.class_id
       JOIN users u    ON u.id = s.user_id
       JOIN classes c  ON c.id = s.class_id
       JOIN fee_payments fp
         ON fp.fee_structure_id = fs.id AND fp.student_id = s.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY u.name, s.student_number, s.id, c.name, c.section, fs.amount
       HAVING fs.amount <= SUM(fp.amount_paid)
       ORDER BY c.name, u.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// GET /api/fees/summary?term=&academic_year=
// School-wide fee collection summary
async function summary(req, res) {
  const { term, academic_year } = req.query;
  if (!term || !academic_year) return error(res, 'term and academic_year are required');
  try {
    const { rows: [totals] } = await pool.query(
      `SELECT
         COUNT(DISTINCT s.id) AS total_students,
         COALESCE(SUM(fs.amount), 0) AS total_expected,
         COALESCE(SUM(fp.amount_paid), 0) AS total_collected,
         COALESCE(SUM(fs.amount) - SUM(fp.amount_paid), 0) AS total_outstanding,
         COUNT(DISTINCT CASE WHEN fs.amount <= COALESCE(sub.paid,0) THEN s.id END) AS cleared_count,
         COUNT(DISTINCT CASE WHEN fs.amount > COALESCE(sub.paid,0) THEN s.id END) AS defaulters_count
       FROM fee_structures fs
       JOIN students s ON s.class_id = fs.class_id
       LEFT JOIN fee_payments fp ON fp.fee_structure_id = fs.id AND fp.student_id = s.id
       LEFT JOIN (
         SELECT student_id, fee_structure_id, SUM(amount_paid) AS paid
         FROM fee_payments GROUP BY student_id, fee_structure_id
       ) sub ON sub.fee_structure_id = fs.id AND sub.student_id = s.id
       WHERE fs.term = $1 AND fs.academic_year = $2`,
      [term, academic_year]
    );

    // Per class breakdown
    const { rows: byClass } = await pool.query(
      `SELECT c.name AS class_name, c.section,
              COUNT(DISTINCT s.id) AS students,
              COALESCE(SUM(fs.amount),0) AS expected,
              COALESCE(SUM(fp.amount_paid),0) AS collected
       FROM fee_structures fs
       JOIN students s ON s.class_id = fs.class_id
       JOIN classes c  ON c.id = s.class_id
       LEFT JOIN fee_payments fp ON fp.fee_structure_id = fs.id AND fp.student_id = s.id
       WHERE fs.term = $1 AND fs.academic_year = $2
       GROUP BY c.id, c.name, c.section ORDER BY c.name`,
      [term, academic_year]
    );

    return success(res, { totals, by_class: byClass });
  } catch (err) { return serverError(res, err); }
}

module.exports = {
  listStructures, createStructure, updateStructure,
  listPayments, recordPayment,
  studentBalance, defaulters, cleared, summary,
};