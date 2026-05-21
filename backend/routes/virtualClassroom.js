const express = require('express');
const ctrl    = require('../controllers/virtualClassroomController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const HOST_ROLES = ['admin','teacher','headmaster','accountant','cashier','admissions_officer'];
const ALL        = [...HOST_ROLES, 'student', 'parent'];

router.get('/',                          authorize(...ALL),       ctrl.list);
router.post('/',                         authorize(...HOST_ROLES),ctrl.create);
router.get('/join/:roomCode',            authorize(...ALL),       ctrl.joinByCode);
router.get('/:id',                       authorize(...ALL),       ctrl.getOne);
router.delete('/:id',                    authorize(...HOST_ROLES),ctrl.remove);
router.post('/:id/start',                authorize(...HOST_ROLES),ctrl.startSession);
router.post('/:id/end',                  authorize(...HOST_ROLES),ctrl.endSession);
router.post('/:id/materials',            authorize(...HOST_ROLES),ctrl.addMaterial);
router.delete('/:id/materials/:matId',   authorize(...HOST_ROLES),ctrl.removeMaterial);
router.post('/:id/messages',             authorize(...ALL),       ctrl.sendMessage);
router.get('/:id/messages',              authorize(...ALL),       ctrl.getMessages);
router.post('/:id/qa',                   authorize(...ALL),       ctrl.askQuestion);
router.put('/:id/qa/:qaId/answer',       authorize(...HOST_ROLES),ctrl.answerQuestion);
router.put('/:id/qa/:qaId/upvote',       authorize(...ALL),       ctrl.upvoteQuestion);

module.exports = router;