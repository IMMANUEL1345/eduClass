const express = require('express');
const ctrl    = require('../controllers/timetableController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const ALL   = ['admin','teacher','student','parent','accountant','cashier','admissions_officer','headmaster'];
const MANAGE = ['admin','headmaster'];

router.get('/class',              authorize(...ALL),    ctrl.getClassTimetable);
router.get('/teacher',            authorize(...ALL),    ctrl.getTeacherTimetable);

router.post('/generate',          authorize(...MANAGE), ctrl.generateTimetable);
router.post('/regenerate',        authorize(...MANAGE), ctrl.regenerateTimetable);
router.post('/approve',           authorize(...MANAGE), ctrl.approveTimetable);

router.post('/',                  authorize(...MANAGE), ctrl.addEntry);
router.put('/:id',                authorize(...MANAGE), ctrl.updateEntry);
router.delete('/:id',             authorize(...MANAGE), ctrl.removeEntry);

router.get('/assignments',        authorize('admin','teacher','headmaster'), ctrl.listAssignments);
router.post('/assignments',       authorize(...MANAGE), ctrl.assign);
router.delete('/assignments/:id', authorize(...MANAGE), ctrl.removeAssignment);

module.exports = router;