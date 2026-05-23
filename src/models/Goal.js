const mongoose = require('mongoose');

// ─── Goal Model ───────────────────────────────────────────────────────
const goalSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['weight_loss', 'weight_gain', 'muscle_gain', 'calorie_target',
           'protein_target', 'sugar_reduction', 'water_intake', 'custom'],
    required: true
  },
  title:       String,
  description: String,

  // ─── Target ───────────────────────────────────────────────────────
  targetValue:  Number,
  targetUnit:   String,
  currentValue: Number,
  startValue:   Number,

  // ─── Timeline ─────────────────────────────────────────────────────
  startDate:  { type: Date, default: Date.now },
  targetDate: Date,
  completedAt: Date,

  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'abandoned'],
    default: 'active'
  },

  // ─── Progress Entries ─────────────────────────────────────────────
  progressLogs: [{
    date:  Date,
    value: Number,
    note:  String
  }],

  // ─── Reminders ────────────────────────────────────────────────────
  reminderEnabled: { type: Boolean, default: true },
  reminderTime:    String   // "08:00"
}, { timestamps: true });

goalSchema.virtual('progressPercent').get(function() {
  if (!this.targetValue || !this.startValue) return 0;
  const progress = Math.abs(this.currentValue - this.startValue);
  const total = Math.abs(this.targetValue - this.startValue);
  return Math.min(Math.round((progress / total) * 100), 100);
});

goalSchema.index({ user: 1, status: 1 });

// ─── AI Recommendation Model ──────────────────────────────────────────
const aiRecommendationSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['meal_plan', 'food_swap', 'health_alert', 'weekly_report',
           'grocery_list', 'pattern_detection', 'recipe'],
    required: true
  },

  title:   { type: String, required: true },
  content: { type: String, required: true },
  data:    mongoose.Schema.Types.Mixed,    // structured data, varies by type

  // ─── Context ──────────────────────────────────────────────────────
  triggerReason:  String,
  relatedFoodLog: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodLog' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

  isRead:    { type: Boolean, default: false },
  isActedOn: { type: Boolean, default: false },
  expiresAt: Date
}, { timestamps: true });

aiRecommendationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = {
  Goal:             mongoose.model('Goal', goalSchema),
  AIRecommendation: mongoose.model('AIRecommendation', aiRecommendationSchema)
};
