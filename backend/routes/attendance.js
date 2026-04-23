// ── attendance.js ────────────────────────────────────────
const express      = require('express');
const attCtrl      = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.post('/',                        authorize('teacher','headmaster'),              attCtrl.mark);
router.get('/',                         authorize('admin','teacher','headmaster'),      attCtrl.query);
router.put('/:id',                      authorize('teacher','admin','headmaster'),      attCtrl.update);
router.get('/absentees',                authorize('admin','teacher','headmaster'),      attCtrl.absentees);
router.get('/summary/:studentId',       authorize('admin','teacher','parent','headmaster'), attCtrl.summary);

module.exports = router;