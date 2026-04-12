const express = require('express');
const ctrl    = require('../controllers/teacherController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/',                authorize('admin'),             ctrl.list);
router.post('/',               authorize('admin'),             ctrl.create);
router.get('/:id',             authorize('admin','teacher'),   ctrl.getOne);
router.put('/:id',             authorize('admin'),             ctrl.update);
router.get('/:id/classes',     authorize('admin','teacher'),   ctrl.getClasses);
router.get('/:id/subjects',    authorize('admin','teacher'),   ctrl.getSubjects);

module.exports = router;
