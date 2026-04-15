const express = require('express');
const ctrl = require('../controllers/expenseController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/summary',    authorize('admin', 'accountant'),  ctrl.summary);
router.get('/',           authorize('admin', 'accountant'),  ctrl.list);
router.post('/',          authorize('accountant'),           ctrl.create);
router.put('/:id',        authorize('accountant'),           ctrl.update);
router.post('/:id/approve', authorize('admin'),              ctrl.approve);
router.post('/:id/reject',  authorize('admin'),              ctrl.reject);
router.delete('/:id',     authorize('accountant'),           ctrl.remove);

module.exports = router;