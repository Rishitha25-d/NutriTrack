const router = require('express').Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/nutritionController');

router.use(protect);

router.get('/search',           c.searchFoods);
router.get('/item/:id',         c.getFoodItem);
router.get('/indian',           c.getIndianFoods);
router.post('/custom',          c.addCustomFood);
router.get('/usda/:query',      c.searchUSDA);
router.get('/edamam/:query',    c.searchEdamam);

module.exports = router;
