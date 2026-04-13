const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { success, created, error, serverError } = require('../utils/response');
const { sendRegistrationConfirmation, sendNewParentNotification } = require('../utils/mailer');

async function register(req, res) {
  const { name, email, password, phone, occupation } = req.body;
  if (!name || !email || !password) return error(res, 'Name, email and password are required');
  if (password.length < 8) return error(res, 'Password must be at least 8 characters');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]
    );
    if (existing[0]) return error(res, 'An account with this email already exists', 409);

    const hash = await bcrypt.hash(password, 12);
    const { rows: [u] } = await client.query(
      `INSERT INTO users (name, email, password_hash, role, force_password_change)
       VALUES ($1,$2,$3,'parent',FALSE) RETURNING id`,
      [name, email.toLowerCase().trim(), hash]
    );

    await client.query(
      'INSERT INTO parents (user_id, phone, occupation) VALUES ($1,$2,$3)',
      [u.id, phone || null, occupation || null]
    );

    await client.query('COMMIT');

    // Send confirmation to parent
    sendRegistrationConfirmation(email.toLowerCase().trim(), name).catch(console.error);

    // Notify all admins
    const { rows: admins } = await pool.query(
      "SELECT email FROM users WHERE role = 'admin' AND is_active = TRUE"
    );
    for (const admin of admins) {
      sendNewParentNotification(admin.email, name, email).catch(console.error);
    }

    return created(res, {}, 'Account created successfully. A confirmation email has been sent.');
  } catch (err) {
    await client.query('ROLLBACK');
    return serverError(res, err);
  } finally {
    client.release();
  }
}

module.exports = { register };