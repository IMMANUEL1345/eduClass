const express = require('express');
const ctrl    = require('../controllers/staffAttendanceController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const STAFF = ['admin','teacher','accountant','cashier','admissions_officer','headmaster'];

router.post('/check-in',   authorize(...STAFF),    ctrl.checkIn);
router.post('/check-out',  authorize(...STAFF),    ctrl.checkOut);
router.get('/today',       authorize(...STAFF),    ctrl.todayStatus);
router.get('/my-history',  authorize(...STAFF),    ctrl.myHistory);
router.get('/daily',       authorize('admin','headmaster'), ctrl.dailyOverview);
router.get('/report',      authorize('admin','headmaster'), ctrl.report);
router.post('/manual',     authorize('admin','headmaster'), ctrl.manual);

module.exports = router;