const mongoose = require('mongoose');

const foodItemSchema = new mongoose.Schema({
  // ─── Identity ─────────────────────────────────────────────────────
  name:        { type: String, required: true, trim: true },
  nameHindi:   String,
  nameTamil:   String,
  nameTelugu:  String,
  brand:       String,
  barcode:     { type: String, index: true },
  category: {
    type: String,
    enum: [
      'indian_breakfast', 'indian_lunch', 'indian_dinner', 'indian_snack',
      'indian_sweet', 'indian_beverage', 'south_indian', 'north_indian',
      'street_food', 'packaged', 'fruit', 'vegetable', 'dairy',
      'meat', 'seafood', 'grain', 'legume', 'oil_fat', 'beverage', 'other'
    ]
  },
  subcategory: String,
  tags:        [String],    // e.g. ['vegetarian', 'vegan', 'gluten_free', 'high_protein']
  region:      String,      // e.g. 'South India', 'Punjab', 'Bengal'

  // ─── Nutrition per 100g/100ml ──────────────────────────────────────
  nutritionPer100g: {
    calories:     { type: Number, required: true },
    protein:      Number,
    carbs:        Number,
    fat:          Number,
    sugar:        Number,
    fiber:        Number,
    sodium:       Number,
    cholesterol:  Number,
    calcium:      Number,
    iron:         Number,
    vitaminC:     Number,
    vitaminD:     Number,
    potassium:    Number,
    saturatedFat: Number,
    transFat:     Number
  },

  // ─── Common Serving Sizes ──────────────────────────────────────────
  servingSizes: [{
    label:  String,   // e.g. "1 bowl", "1 piece"
    grams:  Number    // equivalent in grams
  }],
  defaultServing: {
    label: String,
    grams: Number
  },

  // ─── Packaged Food Extras ──────────────────────────────────────────
  ingredients:    [String],
  allergens:      [String],
  certifications: [String],  // FSSAI, ISO, etc.
  imageUrl:       String,

  // ─── Health Rating ─────────────────────────────────────────────────
  healthScore:    { type: Number, min: 0, max: 10 },
  healthTags:     [String],
  warnings:       [String],    // 'high_sugar', 'high_sodium', etc.

  // ─── Meta ──────────────────────────────────────────────────────────
  dataSource:    { type: String, enum: ['manual', 'usda', 'edamam', 'open_food_facts', 'custom'] },
  externalId:    String,
  isVerified:    { type: Boolean, default: false },
  isActive:      { type: Boolean, default: true },
  viewCount:     { type: Number, default: 0 }
}, {
  timestamps: true
});

// ─── Indexes ──────────────────────────────────────────────────────────
foodItemSchema.index({ name: 'text', brand: 'text', nameHindi: 'text', nameTelugu: 'text' });
foodItemSchema.index({ barcode: 1 });
foodItemSchema.index({ category: 1, healthScore: -1 });

// ─── Method: calculate for custom portion ─────────────────────────────
foodItemSchema.methods.nutritionForPortion = function(grams) {
  const n = this.nutritionPer100g;
  const factor = grams / 100;
  const result = {};
  Object.keys(n.toObject ? n.toObject() : n).forEach(key => {
    result[key] = Math.round((n[key] || 0) * factor * 10) / 10;
  });
  return result;
};

module.exports = mongoose.model('FoodItem', foodItemSchema);
