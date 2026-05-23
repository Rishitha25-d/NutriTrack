const User = require('../models/User');
const { validationResult } = require('express-validator');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ user: user.toPublicJSON() });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'dateOfBirth', 'gender', 'height', 'weight',
                     'targetWeight', 'fitnessGoal', 'activityLevel', 'dietType',
                     'healthConditions', 'allergies', 'cuisinePreferences', 'familyMembers', 'avatar'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    // Auto-recalculate targets if body metrics changed
    if (updates.weight || updates.height || updates.fitnessGoal || updates.activityLevel) {
      const user = await User.findById(req.user._id);
      Object.assign(user, updates);
      const tdee = user.calculateTDEE();
      user.dailyTargets.calories = tdee;
      // Set macro splits based on goal
      const splits = {
        weight_loss:      { protein: 0.35, carbs: 0.40, fat: 0.25 },
        muscle_gain:      { protein: 0.35, carbs: 0.45, fat: 0.20 },
        keto:             { protein: 0.30, carbs: 0.05, fat: 0.65 },
        high_protein:     { protein: 0.40, carbs: 0.35, fat: 0.25 },
        diabetes_friendly:{ protein: 0.30, carbs: 0.35, fat: 0.35 },
        maintain:         { protein: 0.25, carbs: 0.50, fat: 0.25 }
      };
      const split = splits[user.fitnessGoal] || splits.maintain;
      user.dailyTargets.protein = Math.round((tdee * split.protein) / 4);
      user.dailyTargets.carbs   = Math.round((tdee * split.carbs)   / 4);
      user.dailyTargets.fat     = Math.round((tdee * split.fat)     / 9);
      await user.save();
      return res.json({ user: user.toPublicJSON() });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ user: user.toPublicJSON() });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) { next(err); }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });
    res.json({ message: 'Account deactivated successfully' });
  } catch (err) { next(err); }
};

exports.getBMI = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const bmi = user.getBMI();
    if (!bmi) return res.status(400).json({ error: 'Height and weight required to calculate BMI' });
    res.json(bmi);
  } catch (err) { next(err); }
};

exports.getTDEE = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const tdee = user.calculateTDEE();
    res.json({ tdee, unit: 'kcal/day' });
  } catch (err) { next(err); }
};

exports.updateDailyTargets = async (req, res, next) => {
  try {
    const allowed = ['calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'sodium', 'water'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k]) updates[`dailyTargets.${k}`] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true });
    res.json({ dailyTargets: user.dailyTargets });
  } catch (err) { next(err); }
};

exports.updateNotifications = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { notifications: req.body } },
      { new: true }
    );
    res.json({ notifications: user.notifications });
  } catch (err) { next(err); }
};

// ─── Admin ────────────────────────────────────────────────────────────
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, plan } = req.query;
    const filter = { isActive: true };
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
    if (plan) filter['subscription.plan'] = plan;
    const users = await User.find(filter)
      .select('-password -refreshToken -resetPasswordToken -emailVerifyToken')
      .sort({ createdAt: -1 })
      .limit(limit * 1).skip((page - 1) * limit);
    const total = await User.countDocuments(filter);
    res.json({ users, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
};

exports.adminUpdateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: user.toPublicJSON() });
  } catch (err) { next(err); }
};

exports.adminDeleteUser = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'User deactivated' });
  } catch (err) { next(err); }
};
