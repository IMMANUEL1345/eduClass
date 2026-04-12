const express  = require('express');
const ctrl     = require('../controllers/gradeController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.post('/',                    authorize('teacher'),            ctrl.submit);
router.get('/',                     authorize('admin','teacher'),    ctrl.query);
router.put('/:id',                  authorize('teacher','admin'),    ctrl.update);
router.delete('/:id',               authorize('admin'),              ctrl.remove);
router.get('/leaderboard/:classId', authorize('admin','teacher'),    ctrl.leaderboard);

module.exports = router;
