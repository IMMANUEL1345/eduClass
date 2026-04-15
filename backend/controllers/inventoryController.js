const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const { paginate } = require('../utils/helpers');

function generateReceipt() {
  return `RCP${Date.now().toString().slice(-8)}`;
}

// ── ITEMS ─────────────────────────────────────────────────

async function listItems(req, res) {
  const { category, search, low_stock } = req.query;
  const conditions = ['i.is_active = TRUE']; const params = [];
  if (category)  conditions.push(`i.category = $${params.push(category)}`);
  if (search)    conditions.push(`i.name ILIKE $${params.push('%' + search + '%')}`);
  if (low_stock === 'true') conditions.push(`i.stock_qty <= i.reorder_level`);
  try {
    const { rows } = await pool.query(
      `SELECT i.*, u.name AS created_by_name
       FROM inventory_items i LEFT JOIN users u ON u.id = i.created_by
       WHERE ${conditions.join(' AND ')} ORDER BY i.category, i.name`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function createItem(req, res) {
  const { name, category, price, stock_qty, reorder_level, description, sku } = req.body;
  if (!name || !category || !price) return error(res, 'Name, category and price are required');
  try {
    const { rows: [r] } = await pool.query(
      `INSERT INTO inventory_items (name,category,price,stock_qty,reorder_level,description,sku,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [name, category, price, stock_qty||0, reorder_level||5, description||null, sku||null, req.user.id]
    );
    return created(res, { id: r.id }, 'Item added to inventory');
  } catch (err) {
    if (err.code === '23505') return error(res, 'SKU already exists', 409);
    return serverError(res, err);
  }
}

async function updateItem(req, res) {
  const { name, category, price, stock_qty, reorder_level, description, is_active } = req.body;
  try {
    const { rowCount } = await pool.query(
      `UPDATE inventory_items SET
         name          = COALESCE($1, name),
         category      = COALESCE($2, category),
         price         = COALESCE($3, price),
         stock_qty     = COALESCE($4, stock_qty),
         reorder_level = COALESCE($5, reorder_level),
         description   = COALESCE($6, description),
         is_active     = COALESCE($7, is_active)
       WHERE id = $8`,
      [name||null, category||null, price||null, stock_qty??null,
       reorder_level??null, description||null, is_active??null, req.params.id]
    );
    if (!rowCount) return notFound(res, 'Item not found');
    return success(res, {}, 'Item updated');
  } catch (err) { return serverError(res, err); }
}

async function adjustStock(req, res) {
  const { adjustment, reason } = req.body;
  if (adjustment === undefined) return error(res, 'adjustment (positive or negative number) required');
  try {
    const { rows: [r] } = await pool.query(
      `UPDATE inventory_items SET stock_qty = stock_qty + $1
       WHERE id = $2 RETURNING stock_qty, name`,
      [parseInt(adjustment), req.params.id]
    );
    if (!r) return notFound(res, 'Item not found');
    if (r.stock_qty < 0) {
      await pool.query('UPDATE inventory_items SET stock_qty = 0 WHERE id = $1', [req.params.id]);
      return error(res, 'Stock cannot go below 0');
    }
    return success(res, { new_stock: r.stock_qty }, `Stock adjusted for ${r.name}`);
  } catch (err) { return serverError(res, err); }
}

// ── SALES / POS ───────────────────────────────────────────

async function listSales(req, res) {
  const { from, to, student_id } = req.query;
  const { limit, offset } = paginate(req.query);
  const conditions = ['TRUE']; const params = [];
  if (from)       conditions.push(`s.sold_at >= $${params.push(from)}`);
  if (to)         conditions.push(`s.sold_at <= $${params.push(to + ' 23:59:59')}`);
  if (student_id) conditions.push(`s.student_id = $${params.push(student_id)}`);
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.quantity, s.unit_price, s.total_amount, s.payment_method,
              s.receipt_number, s.sold_at, s.buyer_name, s.notes,
              i.name AS item_name, i.category,
              u.name AS sold_by_name,
              st.student_number, su.name AS student_name
       FROM inventory_sales s
       JOIN inventory_items i ON i.id = s.item_id
       JOIN users u ON u.id = s.sold_by
       LEFT JOIN students st ON st.id = s.student_id
       LEFT JOIN users su ON su.id = st.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.sold_at DESC
       LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`, params
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function recordSale(req, res) {
  const { item_id, student_id, buyer_name, quantity, payment_method, notes } = req.body;
  if (!item_id || !quantity) return error(res, 'item_id and quantity are required');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [item] } = await client.query(
      'SELECT * FROM inventory_items WHERE id = $1 AND is_active = TRUE FOR UPDATE', [item_id]
    );
    if (!item) return notFound(res, 'Item not found');
    if (item.stock_qty < quantity) return error(res, `Insufficient stock. Available: ${item.stock_qty}`);

    const total = parseFloat(item.price) * parseInt(quantity);
    const receipt = generateReceipt();

    await client.query(
      `INSERT INTO inventory_sales
        (item_id,student_id,buyer_name,quantity,unit_price,total_amount,payment_method,receipt_number,sold_by,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [item_id, student_id||null, buyer_name||null, quantity,
       item.price, total, payment_method||'cash', receipt, req.user.id, notes||null]
    );

    await client.query(
      'UPDATE inventory_items SET stock_qty = stock_qty - $1 WHERE id = $2',
      [quantity, item_id]
    );
    await client.query('COMMIT');

    // Check low stock
    const newStock = item.stock_qty - quantity;
    const lowStockWarning = newStock <= item.reorder_level
      ? `Warning: ${item.name} stock is low (${newStock} remaining)` : null;

    return created(res, {
      receipt_number: receipt,
      total_amount: total,
      item_name: item.name,
      low_stock_warning: lowStockWarning,
    }, 'Sale recorded');
  } catch (err) {
    await client.query('ROLLBACK');
    return serverError(res, err);
  } finally { client.release(); }
}

async function salesSummary(req, res) {
  const { from, to } = req.query;
  try {
    const conditions = ['TRUE']; const params = [];
    if (from) conditions.push(`sold_at >= $${params.push(from)}`);
    if (to)   conditions.push(`sold_at <= $${params.push(to + ' 23:59:59')}`);

    const { rows: [totals] } = await pool.query(
      `SELECT COUNT(*) AS transactions,
              SUM(total_amount) AS total_revenue,
              SUM(quantity) AS items_sold
       FROM inventory_sales WHERE ${conditions.join(' AND ')}`, params
    );

    const { rows: byCategory } = await pool.query(
      `SELECT i.category, SUM(s.total_amount) AS revenue, SUM(s.quantity) AS qty
       FROM inventory_sales s JOIN inventory_items i ON i.id = s.item_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY i.category ORDER BY revenue DESC`, params
    );

    const { rows: lowStock } = await pool.query(
      `SELECT id, name, category, stock_qty, reorder_level
       FROM inventory_items WHERE stock_qty <= reorder_level AND is_active = TRUE
       ORDER BY stock_qty ASC`
    );

    return success(res, { totals, by_category: byCategory, low_stock_items: lowStock });
  } catch (err) { return serverError(res, err); }
}

module.exports = { listItems, createItem, updateItem, adjustStock, listSales, recordSale, salesSummary };