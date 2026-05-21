// backend/routes/incidents.js
const express = require('express');
const multer  = require('multer');
const ctrl    = require('../controllers/incidentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 100 * 1024 * 1024, files: 5 }, // 100 MB max, 5 files
  fileFilter(req, file, cb) {
    const ok = /^(image|video|audio)\//i.test(file.mimetype)
      || /pdf|msword|officedocument|text\/plain/.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

const ALL    = ['admin','headmaster','teacher','parent','student'];
const MANAGE = ['admin','headmaster','teacher'];

router.get('/search-subjects',                  authorize(...ALL),    ctrl.searchSubjects);
router.get('/',                                 authorize(...ALL),    ctrl.list);
router.post('/', authorize(...ALL), upload.array('files', 5),        ctrl.create);
router.get('/:id',                              authorize(...ALL),    ctrl.getOne);
router.put('/:id/status',                       authorize(...MANAGE), ctrl.updateStatus);
router.delete('/:id',                           authorize(...ALL),    ctrl.remove);

module.exports = router;