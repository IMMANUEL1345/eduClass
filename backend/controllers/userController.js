const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { success, created, error, notFound, serverError } = require('../utils/response');
const { sendWelcomeEmail } = require('../utils/mailer');

const VALID_ROLES = ['admin', 'teacher', 'parent', 'student', 'accountant', 'cashier', 'admissions_officer', 'headmaster'];
const HEADMASTER_ALLOWED_ROLES = ['teacher', 'accountant', 'cashier', 'admissions_officer'];

function generateTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  let pass = '';
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

function generateCode(prefix) {
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

async function list(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, is_active, force_password_change, created_at
       FROM users ORDER BY role, name`
    );
    return success(res, rows);
  } catch (err) { return serverError(res, err); }
}

async function create(req, res) {
  const { name, email, role, phone, specialization, password } = req.body;
  if (!name || !email || !role) return error(res, 'Name, email and role are required');
  if (!VALID_ROLES.includes(role)) return error(res, `Role must be one of: ${VALID_ROLES.join(', ')}`);
  if (req.user.role === 'headmaster' && !HEADMASTER_ALLOWED_ROLES.includes(role)) {
    return error(res, `As Headmaster you can only create: ${HEADMASTER_ALLOWED_ROLES.join(', ')}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]
    );
    if (existing[0]) return error(res, 'An account with this email already exists', 409);

    const tempPassword = password || generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 12);

    const { rows: [u] } = await client.query(
      `INSERT INTO users (name, email, password_hash, role, force_password_change)
       VALUES ($1,$2,$3,$4,TRUE) RETURNING id`,
      [name, email.toLowerCase().trim(), hash, role]
    );

    if (role === 'teacher') {
      await client.query(
        'INSERT INTO teachers (user_id, staff_number, specialization, phone) VALUES ($1,$2,$3,$4)',
        [u.id, generateCode('TCH'), specialization || null, phone || null]
      );
    } else if (role === 'parent') {
      await client.query(
        'INSERT INTO parents (user_id, phone) VALUES ($1,$2)',
        [u.id, phone || null]
      );
    }

    await client.query('COMMIT');

    // Send welcome email
    sendWelcomeEmail(email.toLowerCase().trim(), name, role, tempPassword).catch(console.error);

    return created(res, { id: u.id, role }, `Account created. Welcome email sent to ${email}.`);
  } catch (err) {
    await client.query('ROLLBACK');
    return serverError(res, err);
  } finally {
    client.release();
  }
}

async function update(req, res) {
  const { name, email, role, is_active } = req.body;
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (!rows[0]) return notFound(res, 'User not found');
    if (req.user.id === parseInt(req.params.id) && is_active === false) {
      return error(res, 'You cannot deactivate your own account');
    }
    await pool.query(
      `UPDATE users SET
        name      = COALESCE($1, name),
        email     = COALESCE($2, email),
        role      = COALESCE($3, role),
        is_active = COALESCE($4, is_active)
       WHERE id = $5`,
      [name || null, email?.toLowerCase().trim() || null, role || null,
       is_active !== undefined ? is_active : null, req.params.id]
    );
    return success(res, {}, 'User updated');
  } catch (err) { return serverError(res, err); }
}

async function resetUserPassword(req, res) {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) return error(res, 'Password must be at least 8 characters');
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (!rows[0]) return notFound(res, 'User not found');
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, force_password_change = TRUE WHERE id = $2',
      [hash, req.params.id]
    );
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.params.id]);
    return success(res, {}, 'Password reset. User will be forced to change on next login.');
  } catch (err) { return serverError(res, err); }
}

async function remove(req, res) {
  if (req.user.id === parseInt(req.params.id)) return error(res, 'You cannot delete your own account');
  if (req.user.role === 'headmaster') return error(res, 'Headmasters cannot delete accounts. Contact admin.');
  try {
    const { rows } = await pool.query('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
    if (!rows[0]) return notFound(res, 'User not found');
    // Hard delete — cascades to related records
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    return success(res, {}, 'User deleted permanently');
  } catch (err) { return serverError(res, err); }
}

module.exports = { list, create, update, resetUserPassword, remove };