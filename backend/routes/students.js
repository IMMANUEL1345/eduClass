const express = require('express');
const ctrl    = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/',          authorize('admin','teacher'),                       ctrl.list);
router.post('/',         authorize('admin'),                                 ctrl.create);
router.get('/:id',       authorize('admin','teacher','parent','student'),    ctrl.getOne);
router.put('/:id',       authorize('admin'),                                 ctrl.update);
router.delete('/:id',    authorize('admin'),                                 ctrl.remove);
router.get('/:id/grades',     authorize('admin','teacher','parent','student'), ctrl.getGrades);
router.get('/:id/attendance', authorize('admin','teacher','parent'),          ctrl.getAttendance);
router.get('/:id/reports',    authorize('admin','parent','student'),          ctrl.getReports);

module.exports = router;
