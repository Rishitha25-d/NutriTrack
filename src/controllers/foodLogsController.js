const FoodLog = require('../models/FoodLog');
const User = require('../models/User');
const { computeHealthScore } = require('../utils/nutritionHelper');

// ─── GET today's log ──────────────────────────────────────────────────
exports.getTodayLog = async (req, res, next) => {
  try {
    const log = await FoodLog.getOrCreateToday(req.user._id);
    const user = await User.findById(req.user._id);
    res.json({ log, targets: user.dailyTargets });
  } catch (err) { next(err); }
};

// ─── GET log for specific date ────────────────────────────────────────
exports.getLogByDate = async (req, res, next) => {
  try {
    const date = new Date(req.params.date);
    date.setHours(0, 0, 0, 0);
    if (isNaN(date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });

    const log = await FoodLog.findOne({ user: req.user._id, date });
    if (!log) return res.json({ log: null, message: 'No entries for this date' });

    const user = await User.findById(req.user._id);
    res.json({ log, targets: user.dailyTargets });
  } catch (err) { next(err); }
};

// ─── GET logs for date range ──────────────────────────────────────────
exports.getLogsByRange = async (req, res, next) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });

    const startDate = new Date(start); startDate.setHours(0, 0, 0, 0);
    const endDate   = new Date(end);   endDate.setHours(23, 59, 59, 999);

    const logs = await FoodLog.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    res.json({ logs, count: logs.length });
  } catch (err) { next(err); }
};

// ─── POST add food entry ──────────────────────────────────────────────
exports.addEntry = async (req, res, next) => {
  try {
    const {
      foodName, brand, barcode, imageUrl, source,
      portionSize, portionUnit, servingSize,
      nutrition, mealType,
      aiConfidence, isAiEstimated, ingredients,
      healthRating, healthTags, aiWarnings, aiSuggestion
    } = req.body;

    if (!foodName || !portionSize || !mealType) {
      return res.status(400).json({ error: 'foodName, portionSize, and mealType are required' });
    }

    const log = await FoodLog.getOrCreateToday(req.user._id);

    const entry = {
      foodName, brand, barcode, imageUrl, source,
      portionSize, portionUnit: portionUnit || 'g', servingSize,
      nutrition: nutrition || {},
      mealType,
      aiConfidence, isAiEstimated, ingredients,
      healthRating, healthTags, aiWarnings, aiSuggestion,
      loggedAt: new Date()
    };

    log.entries.push(entry);

    // Recalculate health score
    const user = await User.findById(req.user._id);
    log.healthScore = computeHealthScore(log.totals, user.dailyTargets);

    // Update streak
    await updateStreak(req.user._id);

    await log.save();

    // Award points
    await User.findByIdAndUpdate(req.user._id, { $inc: { points: 5 } });

    res.status(201).json({
      message: 'Food entry logged!',
      entry: log.entries[log.entries.length - 1],
      totals: log.totals,
      healthScore: log.healthScore
    });
  } catch (err) { next(err); }
};

// ─── PUT update food entry ────────────────────────────────────────────
exports.updateEntry = async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const log = await FoodLog.findOne({ user: req.user._id, date: today });
    if (!log) return res.status(404).json({ error: 'Log not found' });

    const entry = log.entries.id(req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const allowed = ['foodName', 'portionSize', 'portionUnit', 'servingSize', 'nutrition', 'mealType'];
    allowed.forEach(k => { if (req.body[k] !== undefined) entry[k] = req.body[k]; });

    await log.save();
    res.json({ message: 'Entry updated', entry, totals: log.totals });
  } catch (err) { next(err); }
};

// ─── DELETE food entry ────────────────────────────────────────────────
exports.deleteEntry = async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const log = await FoodLog.findOne({ user: req.user._id, date: today });
    if (!log) return res.status(404).json({ error: 'Log not found' });

    log.entries = log.entries.filter(e => e._id.toString() !== req.params.entryId);
    await log.save();
    res.json({ message: 'Entry deleted', totals: log.totals });
  } catch (err) { next(err); }
};

// ─── PUT update water intake ──────────────────────────────────────────
exports.updateWater = async (req, res, next) => {
  try {
    const { glasses } = req.body;
    if (glasses == null) return res.status(400).json({ error: 'glasses required' });
    const log = await FoodLog.getOrCreateToday(req.user._id);
    log.waterGlasses = Math.max(0, Math.min(glasses, 20));
    await log.save();
    res.json({ waterGlasses: log.waterGlasses });
  } catch (err) { next(err); }
};

// ─── PUT update notes/mood ────────────────────────────────────────────
exports.updateNotes = async (req, res, next) => {
  try {
    const { notes, mood } = req.body;
    const log = await FoodLog.getOrCreateToday(req.user._id);
    if (notes !== undefined) log.notes = notes;
    if (mood  !== undefined) log.mood  = mood;
    await log.save();
    res.json({ notes: log.notes, mood: log.mood });
  } catch (err) { next(err); }
};

// ─── GET history (last 30 days) ───────────────────────────────────────
exports.getHistory = async (req, res, next) => {
  try {
    const { days = 30, page = 1, limit = 10 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const logs = await FoodLog.find({
      user: req.user._id,
      date: { $gte: since }
    })
    .select('date totals waterGlasses healthScore entries.mealType entries.foodName entries.nutrition.calories')
    .sort({ date: -1 })
    .limit(limit * 1).skip((page - 1) * limit);

    res.json({ logs, count: logs.length });
  } catch (err) { next(err); }
};

// ─── Helper: Update streak ────────────────────────────────────────────
async function updateStreak(userId) {
  const user = await User.findById(userId);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const lastLog = user.streak.lastLogDate ? new Date(user.streak.lastLogDate) : null;
  if (lastLog) lastLog.setHours(0, 0, 0, 0);

  const isToday = lastLog && lastLog.getTime() === today.getTime();
  if (isToday) return; // already logged today

  const isYesterday = lastLog && lastLog.getTime() === yesterday.getTime();
  user.streak.current = isYesterday ? user.streak.current + 1 : 1;
  user.streak.longest = Math.max(user.streak.longest, user.streak.current);
  user.streak.lastLogDate = today;

  // Award streak badges
  const milestones = { 7: '7-Day Streak', 30: '30-Day Warrior', 100: 'Century Club' };
  if (milestones[user.streak.current]) {
    user.badges.push({ name: milestones[user.streak.current], earnedAt: new Date(), icon: '🔥' });
    user.points += 50;
  }

  await user.save({ validateBeforeSave: false });
}
