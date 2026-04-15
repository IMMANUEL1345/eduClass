const express = require('express');
const ctrl = require('../controllers/timetableController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const ALL_ROLES = ['admin', 'teacher', 'student', 'parent', 'accountant', 'cashier', 'admissions_officer'];

router.get('/class',         authorize(...ALL_ROLES),          ctrl.getClassTimetable);
router.get('/teacher',       authorize(...ALL_ROLES),          ctrl.getTeacherTimetable);
router.post('/',             authorize('admin'),               ctrl.addEntry);
router.put('/:id',           authorize('admin'),               ctrl.updateEntry);
router.delete('/:id',        authorize('admin'),               ctrl.removeEntry);

router.get('/assignments',   authorize('admin', 'teacher'),   ctrl.listAssignments);
router.post('/assignments',  authorize('admin'),               ctrl.assign);
router.delete('/assignments/:id', authorize('admin'),         ctrl.removeAssignment);

module.exports = router;