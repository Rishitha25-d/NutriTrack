const https = require('https');
const FoodItem = require('../models/FoodItem');
const { computeProductHealthScore, buildWarnings } = require('../utils/nutritionHelper');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'NutriTrackAI/1.0 (contact@nutritrack.ai)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

// ─── GET /api/barcode/:barcode ─────────────────────────────────────────
exports.lookupBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;
    if (!/^\d{8,14}$/.test(barcode)) {
      return res.status(400).json({ error: 'Invalid barcode format' });
    }

    // 1. Check local DB cache first
    let localItem = await FoodItem.findOne({ barcode });
    if (localItem) {
      return res.json({ product: formatProduct(localItem, 'local_cache'), cached: true });
    }

    // 2. Fetch from Open Food Facts
    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    const data = await httpsGet(url);

    if (!data || data.status !== 1 || !data.product) {
      return res.status(404).json({
        error: 'Product not found',
        barcode,
        suggestion: 'Try searching by name instead, or add this product manually.'
      });
    }

    const p = data.product;
    const n = p.nutriments || {};

    const nutrition = {
      calories:     Math.round(n['energy-kcal_100g'] || n['energy_100g'] / 4.184 || 0),
      protein:      Math.round((n['proteins_100g']    || 0) * 10) / 10,
      carbs:        Math.round((n['carbohydrates_100g']|| 0) * 10) / 10,
      fat:          Math.round((n['fat_100g']          || 0) * 10) / 10,
      sugar:        Math.round((n['sugars_100g']       || 0) * 10) / 10,
      fiber:        Math.round((n['fiber_100g']        || 0) * 10) / 10,
      sodium:       Math.round((n['sodium_100g']       || 0) * 1000 * 10) / 10,
      saturatedFat: Math.round((n['saturated-fat_100g']|| 0) * 10) / 10,
    };

    const healthScore = computeProductHealthScore(nutrition);
    const warnings    = buildWarnings(nutrition);

    const product = {
      barcode,
      name:         p.product_name || p.product_name_en || 'Unknown Product',
      brand:        p.brands,
      imageUrl:     p.image_front_url || p.image_url,
      ingredients:  p.ingredients_text,
      allergens:    p.allergens_tags?.map(a => a.replace('en:', '')),
      servingSize:  p.serving_size,
      nutrition,
      healthScore,
      warnings,
      nutriscore:   p.nutriscore_grade?.toUpperCase(),
      novaGroup:    p.nova_group,
      labels:       p.labels_tags,
      source:       'open_food_facts'
    };

    // Cache to local DB (background)
    FoodItem.create({
      name:           product.name,
      brand:          product.brand,
      barcode,
      nutritionPer100g: nutrition,
      ingredients:    p.ingredients_text?.split(',').map(s => s.trim()).slice(0, 20),
      allergens:      product.allergens,
      imageUrl:       product.imageUrl,
      healthScore,
      warnings,
      dataSource:     'open_food_facts',
      category:       'packaged',
      isVerified:     false
    }).catch(() => {}); // Silently fail if duplicate

    res.json({ product, cached: false });
  } catch (err) { next(err); }
};

function formatProduct(item, source) {
  return {
    barcode:    item.barcode,
    name:       item.name,
    brand:      item.brand,
    imageUrl:   item.imageUrl,
    ingredients: item.ingredients,
    allergens:  item.allergens,
    nutrition:  item.nutritionPer100g,
    healthScore: item.healthScore,
    warnings:   item.warnings,
    source
  };
}
