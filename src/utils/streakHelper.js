// ─── streakHelper.js ──────────────────────────────────────────────────
const mongoose = require('mongoose');

exports.checkAndUpdateStreaks = async () => {
  const User    = require('../models/User');
  const FoodLog = require('../models/FoodLog');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // Find users who didn't log yesterday — reset their streak
  const loggedYesterday = await FoodLog.distinct('user', { date: yesterday });
  const result = await User.updateMany(
    {
      _id:                   { $nin: loggedYesterday },
      'streak.current':      { $gt: 0 },
      'streak.lastLogDate':  { $lt: yesterday }
    },
    { $set: { 'streak.current': 0 } }
  );
  console.log(`Streaks reset for ${result.modifiedCount} users`);
};
