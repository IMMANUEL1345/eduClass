const express = require('express');
const ctrl    = require('../controllers/gradeController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const STAFF = ['admin', 'teacher', 'headmaster'];

// ── New multi-component endpoints ─────────────────────────
router.get('/weights',            authorize(...STAFF),           ctrl.getWeights);
router.post('/weights',           authorize('admin','headmaster','teacher'), ctrl.setWeights);
router.get('/scores',             authorize(...STAFF),           ctrl.getClassScores);
router.post('/scores',            authorize('teacher','admin'),  ctrl.bulkUpsert);

// ── Legacy endpoints ─────────────────────────────────────
router.post('/',                  authorize('teacher'),          ctrl.submit);
router.get('/',                   authorize(...STAFF),           ctrl.query);
router.put('/:id',                authorize('teacher','admin'),  ctrl.update);
router.delete('/:id',             authorize('admin'),            ctrl.remove);
router.get('/leaderboard/:classId', authorize(...STAFF),         ctrl.leaderboard);

module.exports = router;