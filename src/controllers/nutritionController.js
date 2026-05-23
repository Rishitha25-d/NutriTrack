const https = require('https');
const FoodItem = require('../models/FoodItem');

// ─── Helper: HTTPS GET ─────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
    }).on('error', reject);
  });
}

// ─── GET /api/nutrition/search ─────────────────────────────────────────
exports.searchFoods = async (req, res, next) => {
  try {
    const { q, category, page = 1, limit = 20 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const filter = {
      isActive: true,
      $text: { $search: q }
    };
    if (category) filter.category = category;

    const items = await FoodItem.find(filter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' }, viewCount: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await FoodItem.countDocuments(filter);

    // Increment view count for top result
    if (items.length > 0) {
      FoodItem.findByIdAndUpdate(items[0]._id, { $inc: { viewCount: 1 } }).exec();
    }

    res.json({ items, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// ─── GET /api/nutrition/item/:id ───────────────────────────────────────
exports.getFoodItem = async (req, res, next) => {
  try {
    const item = await FoodItem.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewCount: 1 } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Food item not found' });
    res.json({ item });
  } catch (err) { next(err); }
};

// ─── GET /api/nutrition/indian ─────────────────────────────────────────
exports.getIndianFoods = async (req, res, next) => {
  try {
    const { category, region, diet } = req.query;
    const filter = {
      isActive: true,
      category: { $in: [
        'indian_breakfast', 'indian_lunch', 'indian_dinner', 'indian_snack',
        'indian_sweet', 'south_indian', 'north_indian', 'street_food'
      ]}
    };
    if (category) filter.category = category;
    if (region)   filter.region   = { $regex: region, $options: 'i' };
    if (diet)     filter.tags     = diet;

    const items = await FoodItem.find(filter).sort({ viewCount: -1 }).limit(50);
    res.json({ items });
  } catch (err) { next(err); }
};

// ─── POST /api/nutrition/custom ────────────────────────────────────────
exports.addCustomFood = async (req, res, next) => {
  try {
    const item = await FoodItem.create({
      ...req.body,
      dataSource: 'custom',
      isVerified: false
    });
    res.status(201).json({ item });
  } catch (err) { next(err); }
};

// ─── GET /api/nutrition/usda/:query ────────────────────────────────────
exports.searchUSDA = async (req, res, next) => {
  try {
    if (!process.env.USDA_API_KEY) {
      return res.status(503).json({ error: 'USDA API key not configured' });
    }
    const query = encodeURIComponent(req.params.query);
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${query}&pageSize=10&api_key=${process.env.USDA_API_KEY}`;
    const data = await httpsGet(url);

    const items = (data.foods || []).map(f => ({
      fdcId:    f.fdcId,
      name:     f.description,
      brand:    f.brandOwner,
      category: f.foodCategory,
      nutrition: {
        calories: getNutrient(f.foodNutrients, 1008),
        protein:  getNutrient(f.foodNutrients, 1003),
        carbs:    getNutrient(f.foodNutrients, 1005),
        fat:      getNutrient(f.foodNutrients, 1004),
        sugar:    getNutrient(f.foodNutrients, 2000),
        fiber:    getNutrient(f.foodNutrients, 1079),
        sodium:   getNutrient(f.foodNutrients, 1093)
      }
    }));

    res.json({ items, source: 'USDA FoodData Central' });
  } catch (err) { next(err); }
};

function getNutrient(nutrients, id) {
  const n = (nutrients || []).find(n => n.nutrientId === id);
  return n ? Math.round(n.value * 10) / 10 : 0;
}

// ─── GET /api/nutrition/edamam/:query ──────────────────────────────────
exports.searchEdamam = async (req, res, next) => {
  try {
    if (!process.env.EDAMAM_APP_ID || !process.env.EDAMAM_APP_KEY) {
      return res.status(503).json({ error: 'Edamam API not configured' });
    }
    const query = encodeURIComponent(req.params.query);
    const url = `https://api.edamam.com/api/food-database/v2/parser?app_id=${process.env.EDAMAM_APP_ID}&app_key=${process.env.EDAMAM_APP_KEY}&ingr=${query}&nutrition-type=cooking`;
    const data = await httpsGet(url);

    const items = (data.hints || []).slice(0, 10).map(h => ({
      id:       h.food.foodId,
      name:     h.food.label,
      brand:    h.food.brand,
      category: h.food.category,
      image:    h.food.image,
      nutrition: {
        calories: Math.round(h.food.nutrients?.ENERC_KCAL || 0),
        protein:  Math.round(h.food.nutrients?.PROCNT || 0),
        carbs:    Math.round(h.food.nutrients?.CHOCDF || 0),
        fat:      Math.round(h.food.nutrients?.FAT || 0),
        fiber:    Math.round(h.food.nutrients?.FIBTG || 0)
      }
    }));

    res.json({ items, source: 'Edamam' });
  } catch (err) { next(err); }
};
