const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');

const CURRENT_YEAR = () => {
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
};

function genReceiptNumber(type) {
  const prefix = type === 'feeding' ? 'FDG' : 'TRN';
  return `${prefix}${Date.now().toString().slice(-8)}`;
}

// ── TRANSPORT ZONES ──────────────────────────────────────

async function listZones(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT tz.*,
        (SELECT COUNT(*) FROM student_transport st WHERE st.zone_id = tz.id AND st.is_active = TRUE) AS student_count
       FROM transport_zones tz ORDER BY tz.name`
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function createZone(req, res) {
  const { name, description, daily_rate } = req.body;
  if (!name || !daily_rate) return error(res, 'Name and daily rate required');
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO transport_zones (name, description, daily_rate)
       VALUES ($1,$2,$3) RETURNING *`,
      [name, description || null, daily_rate]
    );
    return created(res, r, 'Zone created');
  } catch (err) { return serverError(res, err); }
}

async function updateZone(req, res) {
  const { name, description, daily_rate, is_active } = req.body;
  try {
    const { rows: [r] } = await pool.query(
      `UPDATE transport_zones SET
         name=$1, description=$2, daily_rate=$3, is_active=$4
       WHERE id=$5 RETURNING *`,
      [name, description || null, daily_rate, is_active ?? true, req.params.id]
    );
    if (!r) return notFound(res, 'Zone not found');
    return success(res, r, 'Zone updated');
  } catch (err) { return serverError(res, err); }
}

async function deleteZone(req, res) {
  try {
    await pool.query('DELETE FROM transport_zones WHERE id=$1', [req.params.id]);
    return success(res, {}, 'Zone deleted');
  } catch (err) { return serverError(res, err); }
}

// ── FEEDING RATES ────────────────────────────────────────

async function listFeedingRates(req, res) {
  const { academic_year, term } = req.query;
  const yr   = academic_year || CURRENT_YEAR();
  const conditions = [`fr.academic_year = $1`];
  const params = [yr];
  if (term) conditions.push(`fr.term = $${params.push(term)}`);
  try {
    const { rows } = await pool.query(
      `SELECT fr.*, c.name AS class_name, c.section
       FROM feeding_rates fr
       JOIN classes c ON c.id = fr.class_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name, c.section`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function upsertFeedingRate(req, res) {
  const { class_id, daily_rate, term, academic_year } = req.body;
  if (!class_id || !daily_rate) return error(res, 'Class and daily rate required');
  const yr = academic_year || CURRENT_YEAR();
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO feeding_rates (class_id, daily_rate, term, academic_year, created_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (class_id, term, academic_year)
       DO UPDATE SET daily_rate = EXCLUDED.daily_rate
       RETURNING *`,
      [class_id, daily_rate, term || 'Term 1', yr, req.user.id]
    );
    return success(res, r, 'Feeding rate saved');
  } catch (err) { return serverError(res, err); }
}

// ── STUDENT TRANSPORT ASSIGNMENT ─────────────────────────

async function assignStudentZone(req, res) {
  const { student_id, zone_id, academic_year } = req.body;
  if (!student_id || !zone_id) return error(res, 'Student and zone required');
  const yr = academic_year || CURRENT_YEAR();
  try {
    await pool.query(
      `INSERT INTO student_transport (student_id, zone_id, academic_year, is_active)
       VALUES ($1,$2,$3,TRUE)
       ON CONFLICT (student_id, academic_year)
       DO UPDATE SET zone_id=$2, is_active=TRUE`,
      [student_id, zone_id, yr]
    );
    return success(res, {}, 'Zone assigned');
  } catch (err) { return serverError(res, err); }
}

async function removeStudentZone(req, res) {
  try {
    await pool.query(
      `UPDATE student_transport SET is_active=FALSE WHERE student_id=$1`,
      [req.params.studentId]
    );
    return success(res, {}, 'Transport removed');
  } catch (err) { return serverError(res, err); }
}

// ── ADVANCE PAYMENTS ─────────────────────────────────────

async function recordPayment(req, res) {
  const { student_id, fee_type, amount, payment_method, term, academic_year, notes } = req.body;
  if (!student_id || !fee_type || !amount) return error(res, 'Student, fee type and amount required');
  if (!['feeding','transport'].includes(fee_type)) return error(res, 'fee_type must be feeding or transport');

  const yr      = academic_year || CURRENT_YEAR();
  const termVal = term || 'Term 1';
  const receipt = genReceiptNumber(fee_type);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Record payment
    const { rows: [pmt] } = await client.query(
      `INSERT INTO daily_fee_payments
        (student_id, fee_type, amount, payment_method, receipt_number,
         term, academic_year, recorded_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [student_id, fee_type, amount, payment_method || 'cash',
       receipt, termVal, yr, req.user.id, notes || null]
    );

    // Upsert balance — add to running total
    await client.query(
      `INSERT INTO daily_fee_balances (student_id, fee_type, balance, academic_year, term)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (student_id, fee_type, academic_year, term)
       DO UPDATE SET balance = daily_fee_balances.balance + EXCLUDED.balance,
                     updated_at = NOW()`,
      [student_id, fee_type, amount, yr, termVal]
    );

    await client.query('COMMIT');

    // Fetch student + class for receipt
    const { rows: [student] } = await pool.query(
      `SELECT u.name, s.student_number, c.name AS class_name, c.section
       FROM students s
       JOIN users u   ON u.id = s.user_id
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1`, [student_id]
    );

    return created(res, {
      ...pmt,
      student_name:   student?.name,
      student_number: student?.student_number,
      class_name:     student?.class_name,
      class_section:  student?.section,
      recorded_by_name: req.user.name,
    }, 'Payment recorded');
  } catch (err) {
    await client.query('ROLLBACK');
    return serverError(res, err);
  } finally { client.release(); }
}

// GET /api/daily-fees/payments — list payments
async function listPayments(req, res) {
  const { fee_type, student_id, date_from, date_to, academic_year, term } = req.query;
  const conditions = ['TRUE']; const params = [];
  if (fee_type)    conditions.push(`dfp.fee_type = $${params.push(fee_type)}`);
  if (student_id)  conditions.push(`dfp.student_id = $${params.push(student_id)}`);
  if (academic_year) conditions.push(`dfp.academic_year = $${params.push(academic_year)}`);
  if (term)        conditions.push(`dfp.term = $${params.push(term)}`);
  if (date_from)   conditions.push(`dfp.payment_date >= $${params.push(date_from)}`);
  if (date_to)     conditions.push(`dfp.payment_date <= $${params.push(date_to)}`);
  try {
    const { rows } = await pool.query(
      `SELECT dfp.*,
              u.name  AS student_name,   s.student_number,
              c.name  AS class_name,     c.section,
              ru.name AS recorded_by_name
       FROM daily_fee_payments dfp
       JOIN students s ON s.id = dfp.student_id
       JOIN users u    ON u.id = s.user_id
       JOIN classes c  ON c.id = s.class_id
       LEFT JOIN users ru ON ru.id = dfp.recorded_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY dfp.created_at DESC
       LIMIT 200`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// GET /api/daily-fees/receipt/:receiptNumber (PUBLIC — no auth)
async function getReceipt(req, res) {
  try {
    // Try daily fee payment first
    const { rows: [dfp] } = await pool.query(
      `SELECT dfp.*,
              u.name  AS student_name,   s.student_number,
              c.name  AS class_name,     c.section,
              ru.name AS recorded_by_name
       FROM daily_fee_payments dfp
       JOIN students s ON s.id = dfp.student_id
       JOIN users u    ON u.id = s.user_id
       JOIN classes c  ON c.id = s.class_id
       LEFT JOIN users ru ON ru.id = dfp.recorded_by
       WHERE dfp.receipt_number = $1`, [req.params.receiptNumber]
    );
    if (dfp) return success(res, { ...dfp, receipt_category: dfp.fee_type });

    // Fall back to school fee payment
    const { rows: [sfp] } = await pool.query(
      `SELECT fp.*,
              u.name  AS student_name,   s.student_number,
              c.name  AS class_name,     c.section,
              ru.name AS recorded_by_name
       FROM fee_payments fp
       JOIN students s ON s.id = fp.student_id
       JOIN users u    ON u.id = s.user_id
       JOIN classes c  ON c.id = s.class_id
       LEFT JOIN users ru ON ru.id = fp.recorded_by
       WHERE fp.receipt_number = $1`, [req.params.receiptNumber]
    );
    if (sfp) return success(res, { ...sfp, receipt_category: 'school_fee' });

    return notFound(res, 'Receipt not found');
  } catch (err) { return serverError(res, err); }
}

// ── DAILY TRACKING ───────────────────────────────────────

// GET /api/daily-fees/daily-status?date=&fee_type=&class_id=
async function dailyStatus(req, res) {
  const { date, fee_type, class_id, academic_year, term } = req.query;
  const trackDate = date || new Date().toISOString().split('T')[0];
  const yr        = academic_year || CURRENT_YEAR();
  const termVal   = term || 'Term 1';
  const feeTypes  = fee_type ? [fee_type] : ['feeding', 'transport'];

  try {
    // Get all students with relevant rates
    let studentQuery = `
      SELECT DISTINCT s.id AS student_id, u.name AS student_name,
             s.student_number, c.id AS class_id, c.name AS class_name, c.section
      FROM students s
      JOIN users u   ON u.id = s.user_id
      JOIN classes c ON c.id = s.class_id
      WHERE s.user_id IS NOT NULL`;
    const params = [];
    if (class_id) studentQuery += ` AND c.id = $${params.push(class_id)}`;
    studentQuery += ' ORDER BY c.name, u.name';

    const { rows: students } = await pool.query(studentQuery, params);

    const result = [];
    for (const st of students) {
      const entry = { ...st, feeding: null, transport: null };

      if (feeTypes.includes('feeding')) {
        // Get feeding rate for this class
        const { rows: [rate] } = await pool.query(
          `SELECT daily_rate FROM feeding_rates
           WHERE class_id=$1 AND academic_year=$2 AND term=$3`,
          [st.class_id, yr, termVal]
        );
        if (rate) {
          const { rows: [bal] } = await pool.query(
            `SELECT balance FROM daily_fee_balances
             WHERE student_id=$1 AND fee_type='feeding' AND academic_year=$2 AND term=$3`,
            [st.student_id, yr, termVal]
          );
          const { rows: [ded] } = await pool.query(
            `SELECT id FROM daily_fee_deductions
             WHERE student_id=$1 AND fee_type='feeding' AND deduction_date=$2`,
            [st.student_id, trackDate]
          );
          entry.feeding = {
            daily_rate:  parseFloat(rate.daily_rate),
            balance:     parseFloat(bal?.balance || 0),
            covered:     !!ded,
            days_remaining: bal ? Math.floor(bal.balance / rate.daily_rate) : 0,
          };
        }
      }

      if (feeTypes.includes('transport')) {
        const { rows: [zone] } = await pool.query(
          `SELECT tz.daily_rate, tz.name AS zone_name
           FROM student_transport st2
           JOIN transport_zones tz ON tz.id = st2.zone_id
           WHERE st2.student_id=$1 AND st2.is_active=TRUE AND st2.academic_year=$2`,
          [st.student_id, yr]
        );
        if (zone) {
          const { rows: [bal] } = await pool.query(
            `SELECT balance FROM daily_fee_balances
             WHERE student_id=$1 AND fee_type='transport' AND academic_year=$2 AND term=$3`,
            [st.student_id, yr, termVal]
          );
          const { rows: [ded] } = await pool.query(
            `SELECT id FROM daily_fee_deductions
             WHERE student_id=$1 AND fee_type='transport' AND deduction_date=$2`,
            [st.student_id, trackDate]
          );
          entry.transport = {
            daily_rate:     parseFloat(zone.daily_rate),
            zone_name:      zone.zone_name,
            balance:        parseFloat(bal?.balance || 0),
            covered:        !!ded,
            days_remaining: bal ? Math.floor(bal.balance / zone.daily_rate) : 0,
          };
        }
      }

      if (entry.feeding !== null || entry.transport !== null) {
        result.push(entry);
      }
    }

    return success(res, result);
  } catch (err) { return serverError(res, err); }
}

// ── DAILY REPORT ─────────────────────────────────────────
async function dailyReport(req, res) {
  const { date_from, date_to, fee_type, academic_year, term } = req.query;
  const yr = academic_year || CURRENT_YEAR();

  const from = date_from || new Date().toISOString().split('T')[0];
  const to   = date_to   || new Date().toISOString().split('T')[0];

  try {
    // Payment summary
    const conditions = [`dfp.payment_date BETWEEN $1 AND $2`, `dfp.academic_year=$3`];
    const params = [from, to, yr];
    if (fee_type)  conditions.push(`dfp.fee_type=$${params.push(fee_type)}`);
    if (term) conditions.push(`dfp.term=$${params.push(term)}`);

    const { rows: payments } = await pool.query(
      `SELECT dfp.fee_type,
              SUM(dfp.amount) AS total_collected,
              COUNT(*)        AS payment_count
       FROM daily_fee_payments dfp
       WHERE ${conditions.join(' AND ')}
       GROUP BY dfp.fee_type`, params
    );

    // Deduction summary
    const dparams = [from, to, yr];
    const dconds  = [`d.deduction_date BETWEEN $1 AND $2`];
    if (fee_type) dconds.push(`d.fee_type=$${dparams.push(fee_type)}`);

    const { rows: deductions } = await pool.query(
      `SELECT d.fee_type,
              SUM(d.amount)  AS total_deducted,
              COUNT(DISTINCT d.student_id) AS students_covered,
              COUNT(*)       AS deduction_count
       FROM daily_fee_deductions d
       WHERE ${dconds.join(' AND ')}
       GROUP BY d.fee_type`, dparams
    );

    // Recent payments list
    const { rows: recentPayments } = await pool.query(
      `SELECT dfp.*, u.name AS student_name, s.student_number,
              c.name AS class_name, c.section, ru.name AS recorded_by_name
       FROM daily_fee_payments dfp
       JOIN students s ON s.id = dfp.student_id
       JOIN users u    ON u.id = s.user_id
       JOIN classes c  ON c.id = s.class_id
       LEFT JOIN users ru ON ru.id = dfp.recorded_by
       WHERE dfp.payment_date BETWEEN $1 AND $2 AND dfp.academic_year=$3
       ORDER BY dfp.created_at DESC LIMIT 100`,
      [from, to, yr]
    );

    return success(res, { payments, deductions, recentPayments, from, to });
  } catch (err) { return serverError(res, err); }
}

// ── BALANCES ─────────────────────────────────────────────
async function listBalances(req, res) {
  const { class_id, fee_type, academic_year, term } = req.query;
  const yr      = academic_year || CURRENT_YEAR();
  const termVal = term || 'Term 1';
  const conds   = [`dfb.academic_year=$1`, `dfb.term=$2`];
  const params  = [yr, termVal];
  if (fee_type) conds.push(`dfb.fee_type=$${params.push(fee_type)}`);
  if (class_id) conds.push(`c.id=$${params.push(class_id)}`);
  try {
    const { rows } = await pool.query(
      `SELECT dfb.*, u.name AS student_name, s.student_number,
              c.name AS class_name, c.section
       FROM daily_fee_balances dfb
       JOIN students s ON s.id = dfb.student_id
       JOIN users u    ON u.id = s.user_id
       JOIN classes c  ON c.id = s.class_id
       WHERE ${conds.join(' AND ')}
       ORDER BY c.name, u.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

// ── CRON: run daily deductions (called by jobs/index.js) ──
async function runDailyDeductions() {
  const today  = new Date().toISOString().split('T')[0];
  const yr     = CURRENT_YEAR();
  console.log(`[DailyFees] Running deductions for ${today}`);

  // Skip weekends
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    console.log('[DailyFees] Weekend — skipping deductions');
    return;
  }

  const client = await pool.connect();
  try {
    // ── Feeding deductions ──────────────────────────────
    const { rows: feedingStudents } = await client.query(
      `SELECT dfb.student_id, dfb.balance, dfb.term,
              fr.daily_rate
       FROM daily_fee_balances dfb
       JOIN students s ON s.id = dfb.student_id
       JOIN feeding_rates fr ON fr.class_id = s.class_id
         AND fr.academic_year = dfb.academic_year
         AND fr.term = dfb.term
       WHERE dfb.fee_type = 'feeding'
         AND dfb.balance > 0
         AND dfb.academic_year = $1
         AND NOT EXISTS (
           SELECT 1 FROM daily_fee_deductions dfd
           WHERE dfd.student_id = dfb.student_id
             AND dfd.fee_type = 'feeding'
             AND dfd.deduction_date = $2
         )`, [yr, today]
    );

    for (const s of feedingStudents) {
      const deduct = Math.min(s.daily_rate, s.balance);
      const newBal = parseFloat(s.balance) - deduct;
      await client.query(
        `INSERT INTO daily_fee_deductions
          (student_id,fee_type,deduction_date,amount,balance_before,balance_after,academic_year,term)
         VALUES ($1,'feeding',$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [s.student_id, today, deduct, s.balance, newBal, yr, s.term]
      );
      await client.query(
        `UPDATE daily_fee_balances SET balance=$1, updated_at=NOW()
         WHERE student_id=$2 AND fee_type='feeding' AND academic_year=$3 AND term=$4`,
        [newBal, s.student_id, yr, s.term]
      );
    }

    // ── Transport deductions ────────────────────────────
    const { rows: transportStudents } = await client.query(
      `SELECT dfb.student_id, dfb.balance, dfb.term,
              tz.daily_rate
       FROM daily_fee_balances dfb
       JOIN student_transport st ON st.student_id = dfb.student_id
         AND st.academic_year = dfb.academic_year AND st.is_active = TRUE
       JOIN transport_zones tz ON tz.id = st.zone_id
       WHERE dfb.fee_type = 'transport'
         AND dfb.balance > 0
         AND dfb.academic_year = $1
         AND NOT EXISTS (
           SELECT 1 FROM daily_fee_deductions dfd
           WHERE dfd.student_id = dfb.student_id
             AND dfd.fee_type = 'transport'
             AND dfd.deduction_date = $2
         )`, [yr, today]
    );

    for (const s of transportStudents) {
      const deduct = Math.min(s.daily_rate, s.balance);
      const newBal = parseFloat(s.balance) - deduct;
      await client.query(
        `INSERT INTO daily_fee_deductions
          (student_id,fee_type,deduction_date,amount,balance_before,balance_after,academic_year,term)
         VALUES ($1,'transport',$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [s.student_id, today, deduct, s.balance, newBal, yr, s.term]
      );
      await client.query(
        `UPDATE daily_fee_balances SET balance=$1, updated_at=NOW()
         WHERE student_id=$2 AND fee_type='transport' AND academic_year=$3 AND term=$4`,
        [newBal, s.student_id, yr, s.term]
      );
    }

    console.log(`[DailyFees] Done — feeding: ${feedingStudents.length}, transport: ${transportStudents.length}`);
  } catch (err) {
    console.error('[DailyFees] Deduction error:', err.message);
  } finally { client.release(); }
}

module.exports = {
  listZones, createZone, updateZone, deleteZone,
  listFeedingRates, upsertFeedingRate,
  assignStudentZone, removeStudentZone,
  recordPayment, listPayments, getReceipt,
  dailyStatus, dailyReport, listBalances,
  runDailyDeductions,
};