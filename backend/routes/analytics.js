const express = require('express');
const ctrl    = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/overview',              authorize('admin'),                               ctrl.overview);
router.get('/attendance-trend',      authorize('admin','teacher'),                     ctrl.attendanceTrend);
router.get('/grade-distribution',    authorize('admin','teacher'),                     ctrl.gradeDistribution);
router.get('/class-performance',     authorize('admin','teacher'),                     ctrl.classPerformance);
router.get('/student-progress/:id',  authorize('admin','teacher','parent','student'),  ctrl.studentProgress);

module.exports = router;
