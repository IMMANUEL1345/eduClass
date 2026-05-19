const express = require('express');
const ctrl    = require('../controllers/assignmentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const TEACHERS = ['admin','teacher','headmaster'];
const ALL      = ['admin','teacher','headmaster','student','parent'];

router.get('/my',                                   authorize('student'),     ctrl.myAssignments);
router.get('/child/:studentId',                     authorize('parent'),      ctrl.childAssignments);
router.get('/',                                     authorize(...TEACHERS),   ctrl.list);
router.post('/',                                    authorize(...TEACHERS),   ctrl.create);
router.get('/:id',                                  authorize(...ALL),        ctrl.getOne);
router.put('/:id',                                  authorize(...TEACHERS),   ctrl.update);
router.delete('/:id',                               authorize(...TEACHERS),   ctrl.remove);
router.get('/:id/submissions',                      authorize(...TEACHERS),   ctrl.getSubmissions);
router.post('/:id/submit',                          authorize('student'),     ctrl.submit);
router.put('/:id/submissions/:subId/grade',         authorize(...TEACHERS),   ctrl.grade);

module.exports = router;