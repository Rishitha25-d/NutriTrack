const router = require('express').Router();
const { protect, premiumOnly } = require('../middleware/auth');
const c = require('../controllers/aiController');

router.use(protect);

router.post('/chat',              c.chat);                      // Free: limited
router.post('/analyze-image',     premiumOnly, c.analyzeImage); // Premium
router.get('/meal-plan',          premiumOnly, c.getMealPlan);  // Premium
router.get('/weekly-report',      premiumOnly, c.weeklyReport); // Premium
router.get('/suggestions',        c.getSuggestions);
router.post('/analyze-food-log',  c.analyzeFoodLog);

module.exports = router;
