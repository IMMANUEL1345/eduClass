const express = require('express');
const ctrl    = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const ENROLL_ROLES = ['admin', 'admissions_officer', 'headmaster'];
const VIEW_ROLES   = ['admin', 'teacher', 'admissions_officer', 'headmaster'];

router.get('/my-children',    authorize('parent'),                          ctrl.myChildren);
router.get('/',               authorize(...VIEW_ROLES),                     ctrl.list);
router.post('/bulk',          authorize(...ENROLL_ROLES),                   ctrl.bulkCreate);
router.post('/',              authorize(...ENROLL_ROLES),                   ctrl.create);
router.get('/:id',            authorize(...VIEW_ROLES,'parent','student'),  ctrl.getOne);
router.put('/:id',            authorize(...ENROLL_ROLES),                   ctrl.update);
router.delete('/:id',         authorize('admin'),                           ctrl.remove);
router.get('/:id/grades',     authorize(...VIEW_ROLES,'parent','student'),  ctrl.getGrades);
router.get('/:id/attendance', authorize(...VIEW_ROLES,'parent'),            ctrl.getAttendance);
router.get('/:id/reports',    authorize('admin','parent','student','headmaster'), ctrl.getReports);

module.exports = router;