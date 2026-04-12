const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { success, created, error, serverError } = require('../utils/response');

// POST /api/auth/register  — parent self-registration
async function register(req, res) {
  const { name, email, password, phone, occupation } = req.body;
  if (!name || !email || !password) {
    return error(res, 'Name, email and password are required');
  }
  if (password.length < 8) {
    return error(res, 'Password must be at least 8 characters');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check email not taken
    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]
    );
    if (existing[0]) return error(res, 'An account with this email already exists', 409);

    const hash = await bcrypt.hash(password, 12);
    const { rows: [u] } = await client.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, email.toLowerCase().trim(), hash, 'parent']
    );

    await client.query(
      'INSERT INTO parents (user_id, phone, occupation) VALUES ($1,$2,$3)',
      [u.id, phone || null, occupation || null]
    );

    await client.query('COMMIT');
    return created(res, {}, 'Account created successfully. You can now log in.');
  } catch (err) {
    await client.query('ROLLBACK');
    return serverError(res, err);
  } finally {
    client.release();
  }
}

module.exports = { register };