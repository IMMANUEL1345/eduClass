const express = require('express');
const ctrl    = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const ALL_STAFF = ['admin','teacher','accountant','headmaster'];

router.post('/generate',              authorize('admin','teacher','headmaster'), ctrl.generate);
router.get('/attendance',             authorize(...ALL_STAFF),              ctrl.attendanceReport);
router.get('/enrollment',             authorize('admin','headmaster'),       ctrl.enrollmentReport);
router.get('/fee-collection',         authorize('admin','accountant','headmaster'), ctrl.feeCollectionReport);
router.get('/expense-summary',        authorize('admin','accountant','headmaster'), ctrl.expenseSummaryReport);
router.get('/student/:studentId',     authorize('admin','teacher','parent','student','headmaster'), ctrl.byStudent);
router.get('/class/:classId',         authorize('admin','teacher','headmaster'), ctrl.byClass);
router.get('/:id',                    authorize('admin','teacher','parent','student','headmaster'), ctrl.getOne);

module.exports = router;