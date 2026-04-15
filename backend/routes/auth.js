const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/authController');
const { validate } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login',
  body('email').isEmail(), body('password').notEmpty(), validate,
  ctrl.login
);
router.post('/refresh',          ctrl.refresh);
router.post('/logout',           ctrl.logout);
router.post('/forgot-password',  body('email').isEmail(), validate, ctrl.forgotPassword);
router.post('/reset-password',
  body('token').notEmpty(), body('password').isLength({ min: 8 }), validate,
  ctrl.resetPassword
);
router.post('/change-password',  authenticate, ctrl.changePassword);

module.exports = router;