// ── attendance.js ────────────────────────────────────────
const express      = require('express');
const attCtrl      = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.post('/',                        authorize('teacher'),                          attCtrl.mark);
router.get('/',                         authorize('admin','teacher'),                  attCtrl.query);
router.put('/:id',                      authorize('teacher','admin'),                  attCtrl.update);
router.get('/absentees',                authorize('admin','teacher'),                  attCtrl.absentees);
router.get('/summary/:studentId',       authorize('admin','teacher','parent'),         attCtrl.summary);

module.exports = router;
