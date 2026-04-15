const express = require('express');
const ctrl    = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const ALL_STAFF = ['admin','teacher','accountant'];

router.post('/generate',              authorize('admin','teacher'),         ctrl.generate);
router.get('/attendance',             authorize(...ALL_STAFF),              ctrl.attendanceReport);
router.get('/enrollment',             authorize('admin'),                   ctrl.enrollmentReport);
router.get('/fee-collection',         authorize('admin','accountant'),      ctrl.feeCollectionReport);
router.get('/expense-summary',        authorize('admin','accountant'),      ctrl.expenseSummaryReport);
router.get('/student/:studentId',     authorize('admin','teacher','parent','student'), ctrl.byStudent);
router.get('/class/:classId',         authorize('admin','teacher'),         ctrl.byClass);
router.get('/:id',                    authorize('admin','teacher','parent','student'), ctrl.getOne);

module.exports = router;