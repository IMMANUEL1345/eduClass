const express = require('express');
const ctrl    = require('../controllers/feeController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const FEE_ROLES = ['admin', 'accountant'];

router.get('/structures',          authorize(...FEE_ROLES),                              ctrl.listStructures);
router.post('/structures',         authorize(...FEE_ROLES),                              ctrl.createStructure);
router.put('/structures/:id',      authorize(...FEE_ROLES),                              ctrl.updateStructure);

router.get('/payments',            authorize(...FEE_ROLES),                              ctrl.listPayments);
router.post('/payments',           authorize(...FEE_ROLES),                              ctrl.recordPayment);

router.get('/balance/:studentId',  authorize(...FEE_ROLES, 'parent', 'student'),         ctrl.studentBalance);
router.get('/defaulters',          authorize(...FEE_ROLES, 'admin'),                     ctrl.defaulters);
router.get('/cleared',             authorize(...FEE_ROLES, 'admin'),                     ctrl.cleared);
router.get('/summary',             authorize(...FEE_ROLES, 'admin'),                     ctrl.summary);

module.exports = router;