const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { pool } = require('../config/db');
const { success, error, serverError } = require('../utils/response');
const { sendPasswordReset } = require('../utils/mailer');
require('dotenv').config();

function signAccess(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: parseInt(process.env.JWT_EXPIRES_IN) || 86400 }
  );
}
function signRefresh(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN) || 604800 }
  );
}

async function login(req, res) {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE LIMIT 1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user) return error(res, 'Invalid email or password', 401);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return error(res, 'Invalid email or password', 401);

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);
    const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );
    return success(res, {
      token: accessToken,
      refreshToken,
      user: {
        id:                    user.id,
        name:                  user.name,
        email:                 user.email,
        role:                  user.role,
        force_password_change: user.force_password_change || false,
      },
    });
  } catch (err) { return serverError(res, err); }
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return error(res, 'Refresh token required', 401);
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const { rows } = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW() LIMIT 1',
      [refreshToken]
    );
    if (!rows[0]) return error(res, 'Invalid or expired refresh token', 401);
    const { rows: users } = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [decoded.id]);
    const user = users[0];
    if (!user || !user.is_active) return error(res, 'User not found', 401);
    return success(res, { token: signAccess(user) });
  } catch { return error(res, 'Invalid refresh token', 401); }
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  return success(res, {}, 'Logged out');
}

async function forgotPassword(req, res) {
  const { email } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email FROM users WHERE email = $1 AND is_active = TRUE LIMIT 1',
      [email.toLowerCase().trim()]
    );
    if (!rows[0]) return success(res, {}, 'If that email exists, a reset link has been sent');
    const user    = rows[0];
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
      [token, expires, user.id]
    );
    await sendPasswordReset(user.email, user.name, token);
    return success(res, {}, 'If that email exists, a reset link has been sent');
  } catch (err) { return serverError(res, err); }
}

async function resetPassword(req, res) {
  const { token, password } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_expires > NOW() LIMIT 1', [token]
    );
    if (!rows[0]) return error(res, 'Reset token is invalid or has expired', 400);
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
      [hash, rows[0].id]
    );
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [rows[0].id]);
    return success(res, {}, 'Password reset successfully. Please log in.');
  } catch (err) { return serverError(res, err); }
}

async function changePassword(req, res) {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return error(res, 'Both passwords required');
  if (new_password.length < 8) return error(res, 'Password must be at least 8 characters');
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!user) return error(res, 'User not found', 404);
    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) return error(res, 'Current password is incorrect', 401);
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, force_password_change = FALSE WHERE id = $2',
      [hash, req.user.id]
    );
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);
    return success(res, {}, 'Password changed successfully. Please log in again.');
  } catch (err) { return serverError(res, err); }
}

module.exports = { login, refresh, logout, forgotPassword, resetPassword, changePassword };