const express = require('express');
const ctrl = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const MANAGE_ROLES = ['admin', 'accountant'];
const SELL_ROLES   = ['admin', 'accountant', 'cashier'];

router.get('/items',          authorize(...MANAGE_ROLES),   ctrl.listItems);
router.post('/items',         authorize(...MANAGE_ROLES),   ctrl.createItem);
router.put('/items/:id',      authorize(...MANAGE_ROLES),   ctrl.updateItem);
router.put('/items/:id/stock',authorize(...MANAGE_ROLES),   ctrl.adjustStock);

router.get('/sales',          authorize(...SELL_ROLES),     ctrl.listSales);
router.post('/sales',         authorize(...SELL_ROLES),     ctrl.recordSale);
router.get('/summary',        authorize(...MANAGE_ROLES),   ctrl.salesSummary);

module.exports = router;