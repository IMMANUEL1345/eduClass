const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const { paginate } = require('../utils/helpers');

async function list(req, res) {
  const { category, status, from, to } = req.query;
  const { limit, offset } = paginate(req.query);
  const conditions = ['TRUE']; const params = [];
  if (category) conditions.push(`e.category = $${params.push(category)}`);
  if (status)   conditions.push(`e.status = $${params.push(status)}`);
  if (from)     conditions.push(`e.paid_on >= $${params.push(from)}`);
  if (to)       conditions.push(`e.paid_on <= $${params.push(to)}`);
  try {
    const { rows } = await pool.query(
      `SELECT e.*, u.name AS recorded_by_name, a.name AS approved_by_name
       FROM expenses e
       JOIN users u ON u.id = e.recorded_by
       LEFT JOIN users a ON a.id = e.approved_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.paid_on DESC
       LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function create(req, res) {
  const { title, category, amount, paid_to, paid_on, notes } = req.body;
  if (!title || !category || !amount) return error(res, 'Title, category and amount are required');
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO expenses (title,category,amount,paid_to,paid_on,notes,recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [title, category, amount, paid_to||null,
       paid_on || new Date().toISOString().split('T')[0], notes||null, req.user.id]
    );
    return created(res, { id: r.id }, 'Expense recorded');
  } catch (err) { return serverError(res, err); }
}

async function update(req, res) {
  const { title, category, amount, paid_to, paid_on, notes } = req.body;
  try {
    const { rowCount } = await pool.query(
      `UPDATE expenses SET
         title    = COALESCE($1, title),
         category = COALESCE($2, category),
         amount   = COALESCE($3, amount),
         paid_to  = COALESCE($4, paid_to),
         paid_on  = COALESCE($5, paid_on),
         notes    = COALESCE($6, notes)
       WHERE id = $7 AND status = 'recorded'`,
      [title||null, category||null, amount||null, paid_to||null, paid_on||null, notes||null, req.params.id]
    );
    if (!rowCount) return error(res, 'Expense not found or already approved');
    return success(res, {}, 'Expense updated');
  } catch (err) { return serverError(res, err); }
}

async function approve(req, res) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE expenses SET status='approved', approved_by=$1 WHERE id=$2`,
      [req.user.id, req.params.id]
    );
    if (!rowCount) return notFound(res, 'Expense not found');
    return success(res, {}, 'Expense approved');
  } catch (err) { return serverError(res, err); }
}

async function reject(req, res) {
  try {
    await pool.query(
      `UPDATE expenses SET status='rejected', approved_by=$1 WHERE id=$2`,
      [req.user.id, req.params.id]
    );
    return success(res, {}, 'Expense rejected');
  } catch (err) { return serverError(res, err); }
}

async function remove(req, res) {
  try {
    await pool.query('DELETE FROM expenses WHERE id = $1 AND status = $2', [req.params.id, 'recorded']);
    return success(res, {}, 'Expense deleted');
  } catch (err) { return serverError(res, err); }
}

async function summary(req, res) {
  const { month, year } = req.query;
  try {
    const yr = year || new Date().getFullYear();
    const mn = month || (new Date().getMonth() + 1);

    const { rows: [monthly] } = await pool.query(
      `SELECT SUM(amount) AS total_expenses,
              COUNT(*) AS total_records
       FROM expenses
       WHERE EXTRACT(YEAR FROM paid_on) = $1
         AND EXTRACT(MONTH FROM paid_on) = $2
         AND status != 'rejected'`, [yr, mn]
    );

    const { rows: byCategory } = await pool.query(
      `SELECT category, SUM(amount) AS total
       FROM expenses
       WHERE EXTRACT(YEAR FROM paid_on) = $1 AND status != 'rejected'
       GROUP BY category ORDER BY total DESC`, [yr]
    );

    const { rows: monthlyTrend } = await pool.query(
      `SELECT EXTRACT(MONTH FROM paid_on) AS month,
              SUM(amount) AS total
       FROM expenses
       WHERE EXTRACT(YEAR FROM paid_on) = $1 AND status != 'rejected'
       GROUP BY month ORDER BY month`, [yr]
    );

    return success(res, { monthly, by_category: byCategory, monthly_trend: monthlyTrend });
  } catch (err) { return serverError(res, err); }
}

module.exports = { list, create, update, approve, reject, remove, summary };