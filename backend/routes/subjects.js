// subjects.js
const express = require('express');
const ctrl    = require('../controllers/classController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/',        authorize('admin','teacher'), ctrl.listSubjects);
router.post('/',       authorize('admin','headmaster'), ctrl.createSubject);
router.put('/:id',     authorize('admin','headmaster','teacher'), ctrl.updateSubject);
router.delete('/:id',  authorize('admin','headmaster'), ctrl.removeSubject);

module.exports = router;