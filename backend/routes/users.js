const express = require('express');
const ctrl    = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin'));

router.get('/',                        ctrl.list);
router.post('/',                       ctrl.create);
router.put('/:id',                     ctrl.update);
router.post('/:id/reset-password',     ctrl.resetUserPassword);
router.delete('/:id',                  ctrl.remove);

module.exports = router;