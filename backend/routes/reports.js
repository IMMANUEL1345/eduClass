const express = require('express');
const ctrl    = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.post('/generate',              authorize('admin','teacher'),                         ctrl.generate);
router.get('/student/:studentId',     authorize('admin','parent','student'),                ctrl.byStudent);
router.get('/class/:classId',         authorize('admin','teacher'),                         ctrl.byClass);
router.get('/:id',                    authorize('admin','teacher','parent','student'),       ctrl.getOne);

module.exports = router;
