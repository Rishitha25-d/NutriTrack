const router = require('express').Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/foodLogsController');

router.use(protect);

router.get('/',                   c.getTodayLog);
router.get('/date/:date',         c.getLogByDate);
router.get('/range',              c.getLogsByRange);
router.post('/entry',             c.addEntry);
router.put('/entry/:entryId',     c.updateEntry);
router.delete('/entry/:entryId',  c.deleteEntry);
router.put('/water',              c.updateWater);
router.put('/notes',              c.updateNotes);
router.get('/history',            c.getHistory);

module.exports = router;
