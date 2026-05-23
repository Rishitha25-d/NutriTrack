const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { Goal } = require('../models/Goal');

router.use(protect);

// GET all active goals
router.get('/', async (req, res, next) => {
  try {
    const goals = await Goal.find({ user: req.user._id, status: { $in: ['active', 'paused'] } }).sort({ createdAt: -1 });
    res.json({ goals });
  } catch (err) { next(err); }
});

// POST create goal
router.post('/', async (req, res, next) => {
  try {
    const goal = await Goal.create({ ...req.body, user: req.user._id });
    res.status(201).json({ goal });
  } catch (err) { next(err); }
});

// PUT update goal
router.put('/:id', async (req, res, next) => {
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json({ goal });
  } catch (err) { next(err); }
});

// POST log progress
router.post('/:id/progress', async (req, res, next) => {
  try {
    const { value, note } = req.body;
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      {
        $push: { progressLogs: { date: new Date(), value, note } },
        $set:  { currentValue: value }
      },
      { new: true }
    );
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    // Check if goal completed
    if (goal.type === 'weight_loss' && value <= goal.targetValue) {
      goal.status = 'completed'; goal.completedAt = new Date();
      await goal.save();
    }
    res.json({ goal, progressPercent: goal.progressPercent });
  } catch (err) { next(err); }
});

// DELETE goal
router.delete('/:id', async (req, res, next) => {
  try {
    await Goal.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { status: 'abandoned' });
    res.json({ message: 'Goal removed' });
  } catch (err) { next(err); }
});

module.exports = router;
