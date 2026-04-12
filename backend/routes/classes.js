const express = require('express');
const ctrl    = require('../controllers/classController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/',               authorize('admin','teacher'),   ctrl.list);
router.post('/',              authorize('admin'),              ctrl.create);
router.get('/:id',            authorize('admin','teacher'),   ctrl.getOne);
router.put('/:id',            authorize('admin'),              ctrl.update);
router.delete('/:id',         authorize('admin'),              ctrl.remove);
router.get('/:id/students',   authorize('admin','teacher'),   ctrl.getStudents);
router.get('/:id/subjects',   authorize('admin','teacher'),   ctrl.getSubjects);

module.exports = router;
