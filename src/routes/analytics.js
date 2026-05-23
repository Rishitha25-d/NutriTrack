const router = require('express').Router();
const { protect } = require('../middleware/auth');
const FoodLog = require('../models/FoodLog');
const User    = require('../models/User');

router.use(protect);

// GET /api/analytics/summary?period=week|month|year
router.get('/summary', async (req, res, next) => {
  try {
    const { period = 'week' } = req.query;
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0, 0, 0, 0);

    const logs = await FoodLog.find({ user: req.user._id, date: { $gte: since } }).sort({ date: 1 });
    const user = await User.findById(req.user._id);

    if (!logs.length) return res.json({ message: 'No data for this period', logs: [] });

    const fields = ['calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'sodium'];
    const sums   = Object.fromEntries(fields.map(f => [f, 0]));
    logs.forEach(l => fields.forEach(f => { sums[f] += l.totals?.[f] || 0; }));
    const avgs   = Object.fromEntries(fields.map(f => [f, Math.round(sums[f] / logs.length)]));

    const sugarOverDays = logs.filter(l => (l.totals?.sugar || 0) > user.dailyTargets.sugar).length;

    res.json({
      period, daysLogged: logs.length, totalDays: days,
      averages: avgs,
      totals: sums,
      targets: user.dailyTargets,
      sugarOverLimitDays: sugarOverDays,
      avgHealthScore: Math.round(logs.reduce((s, l) => s + (l.healthScore || 0), 0) / logs.length),
      dailyData: logs.map(l => ({
        date:     l.date,
        calories: l.totals?.calories || 0,
        protein:  l.totals?.protein  || 0,
        sugar:    l.totals?.sugar    || 0,
        score:    l.healthScore || 0,
        water:    l.waterGlasses || 0
      }))
    });
  } catch (err) { next(err); }
});

// GET /api/analytics/macros?period=week
router.get('/macros', async (req, res, next) => {
  try {
    const { period = 'week' } = req.query;
    const days = period === 'week' ? 7 : 30;
    const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0, 0, 0, 0);

    const logs = await FoodLog.find({ user: req.user._id, date: { $gte: since } });
    const totals = { protein: 0, carbs: 0, fat: 0 };
    logs.forEach(l => {
      totals.protein += l.totals?.protein || 0;
      totals.carbs   += l.totals?.carbs   || 0;
      totals.fat     += l.totals?.fat     || 0;
    });
    const total = totals.protein + totals.carbs + totals.fat;
    res.json({
      protein: { grams: Math.round(totals.protein), percent: total ? Math.round(totals.protein / total * 100) : 0 },
      carbs:   { grams: Math.round(totals.carbs),   percent: total ? Math.round(totals.carbs   / total * 100) : 0 },
      fat:     { grams: Math.round(totals.fat),     percent: total ? Math.round(totals.fat     / total * 100) : 0 }
    });
  } catch (err) { next(err); }
});

// GET /api/analytics/streaks
router.get('/streaks', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('streak points badges level');
    res.json({ streak: user.streak, points: user.points, badges: user.badges, level: user.level });
  } catch (err) { next(err); }
});

// GET /api/analytics/nutrients?date=YYYY-MM-DD
router.get('/nutrients', async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    date.setHours(0, 0, 0, 0);
    const log  = await FoodLog.findOne({ user: req.user._id, date });
    const user = await User.findById(req.user._id);
    if (!log) return res.json({ nutrients: {}, targets: user.dailyTargets });
    res.json({ nutrients: log.totals, targets: user.dailyTargets, healthScore: log.healthScore });
  } catch (err) { next(err); }
});

// GET /api/analytics/top-foods?limit=10
router.get('/top-foods', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const since = new Date(); since.setDate(since.getDate() - 30);
    const logs = await FoodLog.find({ user: req.user._id, date: { $gte: since } });
    const foodCount = {};
    logs.forEach(l => l.entries.forEach(e => {
      foodCount[e.foodName] = (foodCount[e.foodName] || 0) + 1;
    }));
    const topFoods = Object.entries(foodCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
    res.json({ topFoods });
  } catch (err) { next(err); }
});

module.exports = router;
