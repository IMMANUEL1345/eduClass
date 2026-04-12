const express = require('express');
const ctrl    = require('../controllers/commsController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Messages
router.get('/messages/inbox',         ctrl.inbox);
router.get('/messages/sent',          ctrl.sent);
router.post('/messages',              ctrl.send);
router.get('/messages/:id',           ctrl.getOne);
router.put('/messages/:id/read',      ctrl.markRead);
router.delete('/messages/:id',        ctrl.remove);

// Announcements
router.get('/announcements',          ctrl.listAnnouncements);
router.post('/announcements',         authorize('admin','teacher'), ctrl.createAnnouncement);

// Notifications
router.get('/notifications',              ctrl.listNotifications);
router.put('/notifications/read-all',     ctrl.markAllRead);
router.put('/notifications/:id/read',     ctrl.markOneRead);
router.delete('/notifications/:id',       ctrl.deleteNotification);

module.exports = router;
