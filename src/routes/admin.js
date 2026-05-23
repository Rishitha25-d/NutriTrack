const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const FoodLog  = require('../models/FoodLog');
const FoodItem = require('../models/FoodItem');
const User     = require('../models/User');

router.use(protect, adminOnly);

// Dashboard stats
router.get('/stats', async (req, res, next) => {
  try {
    const [totalUsers, activeToday, totalFoods, premiumUsers] = await Promise.all([
      User.countDocuments({ isActive: true }),
      FoodLog.countDocuments({ date: { $gte: new Date().setHours(0, 0, 0, 0) } }),
      FoodItem.countDocuments({ isActive: true }),
      User.countDocuments({ 'subscription.plan': { $ne: 'free' } })
    ]);
    res.json({ totalUsers, activeToday, totalFoods, premiumUsers });
  } catch (err) { next(err); }
});

// Manage food database
router.get('/foods',        async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q, verified } = req.query;
    const filter = {};
    if (q)        filter.$text = { $search: q };
    if (verified) filter.isVerified = verified === 'true';
    const items = await FoodItem.find(filter).sort({ createdAt: -1 }).limit(limit * 1).skip((page-1)*limit);
    const total = await FoodItem.countDocuments(filter);
    res.json({ items, total, page: +page, pages: Math.ceil(total/limit) });
  } catch (err) { next(err); }
});

router.post('/foods',       async (req, res, next) => {
  try {
    const item = await FoodItem.create({ ...req.body, isVerified: true, dataSource: 'manual' });
    res.status(201).json({ item });
  } catch (err) { next(err); }
});

router.put('/foods/:id',    async (req, res, next) => {
  try {
    const item = await FoodItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: 'Food not found' });
    res.json({ item });
  } catch (err) { next(err); }
});

router.delete('/foods/:id', async (req, res, next) => {
  try {
    await FoodItem.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Food item removed' });
  } catch (err) { next(err); }
});

// Bulk verify food items
router.post('/foods/bulk-verify', async (req, res, next) => {
  try {
    const { ids } = req.body;
    await FoodItem.updateMany({ _id: { $in: ids } }, { isVerified: true });
    res.json({ message: `${ids.length} items verified` });
  } catch (err) { next(err); }
});

module.exports = router;
