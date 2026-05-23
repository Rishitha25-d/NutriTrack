const mongoose = require('mongoose');

const nutritionSchema = new mongoose.Schema({
  calories:    { type: Number, default: 0 },
  protein:     { type: Number, default: 0 },  // g
  carbs:       { type: Number, default: 0 },  // g
  fat:         { type: Number, default: 0 },  // g
  sugar:       { type: Number, default: 0 },  // g
  fiber:       { type: Number, default: 0 },  // g
  sodium:      { type: Number, default: 0 },  // mg
  cholesterol: { type: Number, default: 0 },  // mg
  calcium:     { type: Number, default: 0 },  // mg
  iron:        { type: Number, default: 0 },  // mg
  vitaminC:    { type: Number, default: 0 },  // mg
  vitaminD:    { type: Number, default: 0 },  // IU
  potassium:   { type: Number, default: 0 },  // mg
  saturatedFat:{ type: Number, default: 0 },  // g
  transFat:    { type: Number, default: 0 }   // g
}, { _id: false });

const foodEntrySchema = new mongoose.Schema({
  // ─── Food Identity ────────────────────────────────────────────────
  foodName:    { type: String, required: true },
  brand:       String,
  barcode:     String,
  imageUrl:    String,
  source: {
    type: String,
    enum: ['manual', 'barcode', 'ai_image', 'search', 'usda', 'edamam', 'open_food_facts'],
    default: 'manual'
  },

  // ─── Portion ──────────────────────────────────────────────────────
  portionSize:  { type: Number, required: true },  // numeric amount
  portionUnit:  { type: String, default: 'g' },    // g, ml, piece, cup, etc.
  servingSize:  String,                             // label e.g. "1 bowl"

  // ─── Nutrition (for this portion) ─────────────────────────────────
  nutrition: nutritionSchema,

  // ─── Meal Type ────────────────────────────────────────────────────
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'snack', 'dinner', 'pre_workout', 'post_workout'],
    required: true
  },
  loggedAt: { type: Date, default: Date.now },

  // ─── AI Metadata ──────────────────────────────────────────────────
  aiConfidence:   Number,       // 0-1, from AI image recognition
  isAiEstimated:  { type: Boolean, default: false },
  ingredients:    [String],
  healthRating:   { type: Number, min: 0, max: 10 },
  healthTags:     [String],     // e.g. ['high_sugar', 'low_fiber', 'good_protein']
  aiWarnings:     [String],
  aiSuggestion:   String        // healthier alternative
}, { _id: true });

const foodLogSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:   { type: Date, required: true },          // date only (midnight UTC)
  entries: [foodEntrySchema],

  // ─── Daily Totals (cached) ─────────────────────────────────────────
  totals: nutritionSchema,
  waterGlasses: { type: Number, default: 0 },

  // ─── Daily Score ──────────────────────────────────────────────────
  healthScore:  { type: Number, default: 0 },     // 0-100
  goalsMet: {
    calories: Boolean,
    protein:  Boolean,
    sugar:    Boolean,
    water:    Boolean
  },

  // ─── Notes ────────────────────────────────────────────────────────
  notes:     String,
  mood:      { type: String, enum: ['great', 'good', 'ok', 'bad', ''] }
}, {
  timestamps: true
});

// ─── Indexes ──────────────────────────────────────────────────────────
foodLogSchema.index({ user: 1, date: -1 });
foodLogSchema.index({ user: 1, date: 1 }, { unique: true });

// ─── Pre-save: recalculate daily totals ───────────────────────────────
foodLogSchema.pre('save', function(next) {
  const totals = {
    calories: 0, protein: 0, carbs: 0, fat: 0,
    sugar: 0, fiber: 0, sodium: 0, cholesterol: 0,
    calcium: 0, iron: 0, vitaminC: 0, vitaminD: 0,
    potassium: 0, saturatedFat: 0, transFat: 0
  };

  this.entries.forEach(entry => {
    Object.keys(totals).forEach(key => {
      totals[key] += (entry.nutrition?.[key] || 0);
    });
  });

  // Round all values
  Object.keys(totals).forEach(k => {
    totals[k] = Math.round(totals[k] * 10) / 10;
  });

  this.totals = totals;
  next();
});

// ─── Static: get or create today's log ───────────────────────────────
foodLogSchema.statics.getOrCreateToday = async function(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let log = await this.findOne({ user: userId, date: today });
  if (!log) {
    log = await this.create({ user: userId, date: today, entries: [] });
  }
  return log;
};

module.exports = mongoose.model('FoodLog', foodLogSchema);
