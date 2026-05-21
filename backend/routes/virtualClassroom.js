const express = require('express');
const ctrl    = require('../controllers/virtualClassroomController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const STAFF_ROLES = ['admin','teacher','headmaster','accountant','cashier','admissions_officer'];
const ALL         = [...STAFF_ROLES, 'student', 'parent'];

// Students CAN create — but controller forces class_id = their own class
const CAN_CREATE  = [...STAFF_ROLES, 'student'];

router.get('/',                          authorize(...ALL),        ctrl.list);
router.post('/',                         authorize(...CAN_CREATE), ctrl.create);   // ← student allowed
router.get('/join/:roomCode',            authorize(...ALL),        ctrl.joinByCode);
router.get('/:id',                       authorize(...ALL),        ctrl.getOne);
router.delete('/:id',                    authorize(...ALL),        ctrl.remove);    // host check is in controller
router.post('/:id/start',                authorize(...ALL),        ctrl.startSession); // host check in controller
router.post('/:id/end',                  authorize(...ALL),        ctrl.endSession);   // host check in controller
router.post('/:id/materials',            authorize(...STAFF_ROLES,'student'), ctrl.addMaterial);
router.delete('/:id/materials/:matId',   authorize(...STAFF_ROLES,'student'), ctrl.removeMaterial);
router.post('/:id/messages',             authorize(...ALL),        ctrl.sendMessage);
router.get('/:id/messages',              authorize(...ALL),        ctrl.getMessages);
router.post('/:id/qa',                   authorize(...ALL),        ctrl.askQuestion);
router.put('/:id/qa/:qaId/answer',       authorize(...STAFF_ROLES),ctrl.answerQuestion);
router.put('/:id/qa/:qaId/upvote',       authorize(...ALL),        ctrl.upvoteQuestion);

module.exports = router;