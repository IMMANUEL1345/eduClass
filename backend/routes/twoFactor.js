const express = require('express');
const ctrl    = require('../controllers/twoFactorController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// These routes require login
router.use(authenticate);
router.get('/status',    ctrl.status);
router.post('/setup',    ctrl.setup);
router.post('/verify',   ctrl.verify);
router.post('/disable',  ctrl.disable);

// This one is called during login (no token yet)
module.exports = router;

// Export validate separately for use in auth routes
module.exports.validate = ctrl.validate;