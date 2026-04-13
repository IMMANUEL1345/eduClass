const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');
const { pool }  = require('../config/db');
const { success, error, serverError } = require('../utils/response');

// POST /api/2fa/setup  — generate secret + QR code
async function setup(req, res) {
  try {
    const secret = speakeasy.generateSecret({
      name:   `EduClass (${req.user.email})`,
      length: 20,
    });

    // Store secret temporarily (not enabled yet)
    await pool.query(
      'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
      [secret.base32, req.user.id]
    );

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return success(res, {
      secret:  secret.base32,
      qr_code: qrCode,
      message: 'Scan the QR code with Google Authenticator or Authy, then verify with a code.',
    });
  } catch (err) { return serverError(res, err); }
}

// POST /api/2fa/verify  — verify OTP and enable 2FA
async function verify(req, res) {
  const { token } = req.body;
  if (!token) return error(res, 'OTP token is required');

  try {
    const { rows } = await pool.query(
      'SELECT two_factor_secret FROM users WHERE id = $1', [req.user.id]
    );
    if (!rows[0]?.two_factor_secret) return error(res, 'Run 2FA setup first');

    const valid = speakeasy.totp.verify({
      secret:   rows[0].two_factor_secret,
      encoding: 'base32',
      token:    token.replace(/\s/g, ''),
      window:   1,
    });

    if (!valid) return error(res, 'Invalid code. Please try again.', 401);

    await pool.query(
      'UPDATE users SET two_factor_enabled = TRUE WHERE id = $1', [req.user.id]
    );
    return success(res, {}, '2FA enabled successfully');
  } catch (err) { return serverError(res, err); }
}

// POST /api/2fa/disable  — disable 2FA
async function disable(req, res) {
  const { token } = req.body;
  if (!token) return error(res, 'OTP token required to disable 2FA');

  try {
    const { rows } = await pool.query(
      'SELECT two_factor_secret FROM users WHERE id = $1', [req.user.id]
    );
    if (!rows[0]?.two_factor_secret) return error(res, '2FA is not set up');

    const valid = speakeasy.totp.verify({
      secret:   rows[0].two_factor_secret,
      encoding: 'base32',
      token:    token.replace(/\s/g, ''),
      window:   1,
    });
    if (!valid) return error(res, 'Invalid code', 401);

    await pool.query(
      'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1',
      [req.user.id]
    );
    return success(res, {}, '2FA disabled');
  } catch (err) { return serverError(res, err); }
}

// POST /api/2fa/validate  — called during login when 2FA is enabled
async function validate(req, res) {
  const { user_id, token } = req.body;
  if (!user_id || !token) return error(res, 'user_id and token are required');

  try {
    const { rows } = await pool.query(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1', [user_id]
    );
    if (!rows[0] || !rows[0].two_factor_enabled) return error(res, '2FA not enabled for this user');

    const valid = speakeasy.totp.verify({
      secret:   rows[0].two_factor_secret,
      encoding: 'base32',
      token:    token.replace(/\s/g, ''),
      window:   1,
    });
    if (!valid) return error(res, 'Invalid 2FA code', 401);
    return success(res, {}, '2FA verified');
  } catch (err) { return serverError(res, err); }
}

// GET /api/2fa/status  — check if 2FA is enabled
async function status(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT two_factor_enabled FROM users WHERE id = $1', [req.user.id]
    );
    return success(res, { enabled: rows[0]?.two_factor_enabled || false });
  } catch (err) { return serverError(res, err); }
}

module.exports = { setup, verify, disable, validate, status };