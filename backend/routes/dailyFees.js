const express = require('express');
const ctrl    = require('../controllers/dailyFeesController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// PUBLIC — receipt verification (no auth)
router.get('/receipt/:receiptNumber', ctrl.getReceipt);

// All other routes require auth
router.use(authenticate);

const STAFF   = ['admin','headmaster','accountant','cashier','teacher'];
const FINANCE = ['admin','headmaster','accountant','cashier'];

// Zones
router.get('/zones',              authorize(...STAFF),   ctrl.listZones);
router.post('/zones',             authorize(...FINANCE),  ctrl.createZone);
router.put('/zones/:id',          authorize(...FINANCE),  ctrl.updateZone);
router.delete('/zones/:id',       authorize('admin','headmaster'), ctrl.deleteZone);

// Feeding rates
router.get('/feeding-rates',      authorize(...STAFF),   ctrl.listFeedingRates);
router.post('/feeding-rates',     authorize(...FINANCE),  ctrl.upsertFeedingRate);

// Student transport assignment
router.post('/assign-zone',       authorize(...FINANCE),  ctrl.assignStudentZone);
router.delete('/assign-zone/:studentId', authorize(...FINANCE), ctrl.removeStudentZone);

// Payments
router.post('/payments',          authorize(...FINANCE),  ctrl.recordPayment);
router.get('/payments',           authorize(...STAFF),   ctrl.listPayments);

// Daily tracking
router.get('/daily-status',       authorize(...STAFF),   ctrl.dailyStatus);
router.get('/balances',           authorize(...STAFF),   ctrl.listBalances);

// Reports
router.get('/report',             authorize(...STAFF),   ctrl.dailyReport);

module.exports = router;