const express = require('express');
const ctrl    = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

const { pool } = require('../config/db');
const router = express.Router();

// User search — available to all authenticated users (for messaging)
router.get('/search', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ ok: true, data: [] });
  try {
    const { rows: staff } = await pool.query(
      `SELECT id, name, email, role FROM users
       WHERE is_active = TRUE AND id != $1
         AND role NOT IN ('student')
         AND (name ILIKE $2 OR email ILIKE $2)
       ORDER BY name LIMIT 10`,
      [req.user.id, `%${q}%`]
    );
    const { rows: students } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role FROM users u
       JOIN students s ON s.user_id = u.id
       WHERE u.is_active = TRUE AND u.id != $1
         AND (u.name ILIKE $2 OR u.email ILIKE $2 OR s.student_number ILIKE $2)
       ORDER BY u.name LIMIT 5`,
      [req.user.id, `%${q}%`]
    );
    return res.json({ ok: true, data: [...staff, ...students] });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

router.use(authenticate);
router.use(authorize('admin', 'headmaster'));

router.get('/',                        ctrl.list);
router.post('/',                       ctrl.create);
router.put('/:id',                     ctrl.update);
router.post('/:id/reset-password',     ctrl.resetUserPassword);
router.delete('/:id',                  authorize('admin'), ctrl.remove);

module.exports = router;