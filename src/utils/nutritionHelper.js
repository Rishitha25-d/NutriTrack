/**
 * NutriTrack AI — Nutrition Helper Utilities
 */

// ─── Compute daily health score (0-100) ───────────────────────────────
exports.computeHealthScore = function(totals = {}, targets = {}) {
  let score = 100;

  // Calorie compliance (±20% = perfect)
  if (targets.calories && totals.calories) {
    const ratio = totals.calories / targets.calories;
    if (ratio < 0.6 || ratio > 1.4) score -= 20;
    else if (ratio < 0.8 || ratio > 1.2) score -= 10;
  }

  // Sugar penalty
  if (targets.sugar && totals.sugar > targets.sugar) {
    const excess = (totals.sugar - targets.sugar) / targets.sugar;
    score -= Math.min(25, Math.round(excess * 40));
  }

  // Sodium penalty
  if (targets.sodium && totals.sodium > targets.sodium) {
    const excess = (totals.sodium - targets.sodium) / targets.sodium;
    score -= Math.min(15, Math.round(excess * 20));
  }

  // Protein bonus/penalty
  if (targets.protein && totals.protein) {
    const ratio = totals.protein / targets.protein;
    if (ratio < 0.5) score -= 15;
    else if (ratio >= 0.8) score += 5;
  }

  // Fiber bonus
  if (targets.fiber && totals.fiber >= targets.fiber) score += 5;

  // Water bonus
  if (targets.water && (totals.water || 0) >= targets.water) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
};

// ─── Compute packaged product health score ────────────────────────────
exports.computeProductHealthScore = function(nutrition = {}) {
  let score = 10;

  // Sugar (per 100g)
  if (nutrition.sugar > 22.5)     score -= 4;
  else if (nutrition.sugar > 12)  score -= 2;
  else if (nutrition.sugar < 5)   score += 1;

  // Saturated fat
  if (nutrition.saturatedFat > 5)   score -= 3;
  else if (nutrition.saturatedFat > 3) score -= 1;

  // Sodium
  if (nutrition.sodium > 600)     score -= 3;
  else if (nutrition.sodium > 300) score -= 1;

  // Fiber bonus
  if (nutrition.fiber > 6)        score += 2;
  else if (nutrition.fiber > 3)   score += 1;

  // Protein bonus
  if (nutrition.protein > 10)     score += 1;

  return Math.max(0, Math.min(10, Math.round(score)));
};

// ─── Build warning tags for a food ────────────────────────────────────
exports.buildWarnings = function(nutrition = {}) {
  const warnings = [];
  if (nutrition.sugar       > 22.5) warnings.push('high_sugar');
  if (nutrition.sodium      > 600)  warnings.push('high_sodium');
  if (nutrition.saturatedFat> 5)    warnings.push('high_saturated_fat');
  if (nutrition.calories    > 500)  warnings.push('high_calorie');
  if (nutrition.transFat    > 0.5)  warnings.push('contains_trans_fat');
  return warnings;
};

// ─── Check if daily intake is within healthy bounds ───────────────────
exports.checkHealthAlerts = function(totals = {}, targets = {}) {
  const alerts = [];

  if (totals.sugar > targets.sugar * 0.8) {
    alerts.push({
      type: 'warning',
      nutrient: 'sugar',
      message: `Sugar intake at ${Math.round(totals.sugar)}g — nearing daily limit of ${targets.sugar}g`,
      severity: totals.sugar > targets.sugar ? 'high' : 'medium'
    });
  }

  if (totals.sodium > targets.sodium) {
    alerts.push({
      type: 'danger',
      nutrient: 'sodium',
      message: `Sodium exceeded: ${Math.round(totals.sodium)}mg vs limit ${targets.sodium}mg`,
      severity: 'high'
    });
  }

  if (targets.protein && totals.protein < targets.protein * 0.5) {
    alerts.push({
      type: 'info',
      nutrient: 'protein',
      message: `Protein low at ${Math.round(totals.protein)}g. Target: ${targets.protein}g`,
      severity: 'low'
    });
  }

  return alerts;
};

// ─── Calculate macros for a portion ───────────────────────────────────
exports.scaleNutrition = function(nutritionPer100g, portionGrams) {
  const factor = portionGrams / 100;
  const result = {};
  Object.entries(nutritionPer100g).forEach(([k, v]) => {
    result[k] = Math.round((v || 0) * factor * 10) / 10;
  });
  return result;
};

// ─── Estimate Indian food nutrition from name ─────────────────────────
const INDIAN_FOOD_DB = {
  'idli':           { calories: 39,  protein: 1.8, carbs: 7.9,  fat: 0.2, sugar: 0.1, fiber: 0.5,  per: 'piece' },
  'dosa':           { calories: 133, protein: 3.4, carbs: 21.8, fat: 3.7, sugar: 0.5, fiber: 1.2,  per: 'piece' },
  'masala dosa':    { calories: 210, protein: 5.0, carbs: 32,   fat: 6,   sugar: 1,   fiber: 2,    per: 'piece' },
  'chapati':        { calories: 105, protein: 3.1, carbs: 20.5, fat: 2.1, sugar: 0.3, fiber: 2.1,  per: 'piece' },
  'dal':            { calories: 180, protein: 10,  carbs: 22,   fat: 5,   sugar: 1,   fiber: 6,    per: 'bowl' },
  'rice':           { calories: 130, protein: 2.7, carbs: 28,   fat: 0.3, sugar: 0,   fiber: 0.4,  per: '100g' },
  'biryani':        { calories: 260, protein: 14,  carbs: 29,   fat: 9,   sugar: 1,   fiber: 1,    per: '100g' },
  'chicken biryani':{ calories: 290, protein: 15,  carbs: 30,   fat: 11,  sugar: 1.5, fiber: 1,    per: '100g' },
  'sambar':         { calories: 50,  protein: 2.5, carbs: 7,    fat: 1,   sugar: 2,   fiber: 2,    per: '100ml' },
  'upma':           { calories: 165, protein: 4,   carbs: 28,   fat: 4,   sugar: 1,   fiber: 1.5,  per: 'bowl' },
  'poha':           { calories: 145, protein: 3,   carbs: 28,   fat: 3,   sugar: 1,   fiber: 1,    per: 'bowl' },
  'paratha':        { calories: 250, protein: 5,   carbs: 35,   fat: 9,   sugar: 0.5, fiber: 2,    per: 'piece' },
  'rajma':          { calories: 130, protein: 8,   carbs: 21,   fat: 1,   sugar: 1,   fiber: 7,    per: '100g' },
  'paneer':         { calories: 265, protein: 18,  carbs: 3,    fat: 20,  sugar: 1.5, fiber: 0,    per: '100g' },
  'chole':          { calories: 200, protein: 9,   carbs: 30,   fat: 5,   sugar: 1,   fiber: 8,    per: 'bowl' },
};

exports.estimateIndianFood = function(foodName = '') {
  const key = foodName.toLowerCase().trim();
  for (const [name, data] of Object.entries(INDIAN_FOOD_DB)) {
    if (key.includes(name)) return { ...data, matched: name, isEstimate: true };
  }
  return null;
};
