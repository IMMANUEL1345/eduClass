const express = require('express');
const ctrl    = require('../controllers/gradeController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const STAFF = ['admin', 'teacher', 'headmaster'];

// ── Weights ───────────────────────────────────────────────
router.get('/weights',              authorize(...STAFF),          ctrl.getWeights);
router.post('/weights',             authorize(...STAFF),          ctrl.setWeights);

// ── Multi-component scores (grid) ────────────────────────
router.get('/scores',               authorize(...STAFF),          ctrl.getClassScores);
router.post('/scores',              authorize('teacher','admin'),  ctrl.bulkUpsert);

// ── Classwork / Homework entries ─────────────────────────
router.get('/entries',              authorize(...STAFF),          ctrl.getEntries);
router.post('/entries',             authorize('teacher','admin'),  ctrl.addEntries);
router.delete('/entries/:id',       authorize('teacher','admin'),  ctrl.deleteEntry);

// ── Student full record ──────────────────────────────────
router.get('/student-record',       authorize(...STAFF),          ctrl.studentRecord);

// ── Student: own grades ─────────────────────────────────
router.get('/my',               authorize('student'),          ctrl.myGrades);

// ── Legacy endpoints ─────────────────────────────────────
router.post('/',                    authorize('teacher'),          ctrl.submit);
router.get('/',                     authorize(...STAFF),           ctrl.query);
router.put('/:id',                  authorize('teacher','admin'),  ctrl.update);
router.delete('/:id',               authorize('admin'),            ctrl.remove);
router.get('/leaderboard/:classId', authorize(...STAFF),           ctrl.leaderboard);

module.exports = router;