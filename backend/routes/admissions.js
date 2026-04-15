const express = require('express');
const ctrl = require('../controllers/admissionController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const ADMISSION_ROLES = ['admin', 'admissions_officer'];

router.get('/stats',   authorize(...ADMISSION_ROLES),    ctrl.stats);
router.get('/',        authorize(...ADMISSION_ROLES),    ctrl.list);
router.post('/',       authorize(...ADMISSION_ROLES),    ctrl.create);
router.get('/:id',     authorize(...ADMISSION_ROLES),    ctrl.getOne);
router.put('/:id',     authorize(...ADMISSION_ROLES),    ctrl.update);
router.post('/:id/approve', authorize(...ADMISSION_ROLES), ctrl.approve);
router.post('/:id/reject',  authorize(...ADMISSION_ROLES), ctrl.reject);

module.exports = router;