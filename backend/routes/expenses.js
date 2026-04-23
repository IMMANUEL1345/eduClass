const express = require('express');
const ctrl = require('../controllers/expenseController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/summary',    authorize('admin', 'accountant', 'headmaster'), ctrl.summary);
router.get('/',           authorize('admin', 'accountant', 'headmaster'), ctrl.list);
router.post('/',          authorize('accountant'),           ctrl.create);
router.put('/:id',        authorize('accountant'),           ctrl.update);
router.post('/:id/approve', authorize('admin', 'headmaster'), ctrl.approve);
router.post('/:id/reject',  authorize('admin', 'headmaster'), ctrl.reject);
router.delete('/:id',     authorize('accountant'),           ctrl.remove);

module.exports = router;