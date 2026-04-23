const express = require('express');
const ctrl    = require('../controllers/teacherController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/',                authorize('admin','headmaster'), ctrl.list);
router.post('/',               authorize('admin','headmaster'), ctrl.create);
router.get('/:id',             authorize('admin','teacher','headmaster'), ctrl.getOne);
router.put('/:id',             authorize('admin','headmaster'), ctrl.update);
router.get('/:id/classes',     authorize('admin','teacher','headmaster'), ctrl.getClasses);
router.get('/:id/subjects',    authorize('admin','teacher','headmaster'), ctrl.getSubjects);

module.exports = router;