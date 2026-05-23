/**
 * NutriTrack AI — Database Seeder
 * Run: node src/utils/seeder.js
 * Run: node src/utils/seeder.js --destroy   (to wipe)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const FoodItem = require('../models/FoodItem');
const User     = require('../models/User');

const indianFoods = [
  // South Indian
  { name: 'Idli', nameHindi: 'इडली', nameTamil: 'இட்லி', nameTelugu: 'ఇడ్లీ', category: 'south_indian', region: 'South India', tags: ['vegetarian', 'low_fat', 'fermented'], nutritionPer100g: { calories: 58, protein: 2.0, carbs: 11.4, fat: 0.3, sugar: 0.5, fiber: 0.7, sodium: 230 }, servingSizes: [{ label: '1 piece', grams: 60 }, { label: '2 pieces', grams: 120 }], defaultServing: { label: '2 pieces', grams: 120 }, healthScore: 8, dataSource: 'manual', isVerified: true },
  { name: 'Masala Dosa', category: 'south_indian', region: 'South India', tags: ['vegetarian'], nutritionPer100g: { calories: 133, protein: 3.4, carbs: 21.8, fat: 3.7, sugar: 0.8, fiber: 1.2, sodium: 280 }, servingSizes: [{ label: '1 dosa', grams: 160 }], defaultServing: { label: '1 dosa', grams: 160 }, healthScore: 7, dataSource: 'manual', isVerified: true },
  { name: 'Plain Dosa', category: 'south_indian', region: 'South India', tags: ['vegetarian', 'low_calorie'], nutritionPer100g: { calories: 110, protein: 2.8, carbs: 18, fat: 2.5, sugar: 0.4, fiber: 0.9, sodium: 220 }, servingSizes: [{ label: '1 dosa', grams: 80 }], defaultServing: { label: '1 dosa', grams: 80 }, healthScore: 8, dataSource: 'manual', isVerified: true },
  { name: 'Sambar', category: 'south_indian', region: 'South India', tags: ['vegetarian', 'high_fiber', 'low_calorie'], nutritionPer100g: { calories: 50, protein: 2.5, carbs: 7, fat: 1, sugar: 2.5, fiber: 2.5, sodium: 320 }, servingSizes: [{ label: '1 bowl (200ml)', grams: 200 }], defaultServing: { label: '1 bowl', grams: 200 }, healthScore: 9, dataSource: 'manual', isVerified: true },
  { name: 'Upma', category: 'indian_breakfast', region: 'South India', tags: ['vegetarian'], nutritionPer100g: { calories: 160, protein: 3.8, carbs: 25, fat: 4.5, sugar: 1.2, fiber: 1.8, sodium: 300 }, servingSizes: [{ label: '1 bowl', grams: 200 }], defaultServing: { label: '1 bowl', grams: 200 }, healthScore: 7, dataSource: 'manual', isVerified: true },
  { name: 'Poha', category: 'indian_breakfast', region: 'Central India', tags: ['vegetarian', 'low_fat'], nutritionPer100g: { calories: 180, protein: 3.2, carbs: 35, fat: 2.8, sugar: 1, fiber: 1.2, sodium: 250 }, servingSizes: [{ label: '1 bowl', grams: 150 }], defaultServing: { label: '1 bowl', grams: 150 }, healthScore: 7, dataSource: 'manual', isVerified: true },
  { name: 'Rava Idli', category: 'south_indian', region: 'South India', tags: ['vegetarian'], nutritionPer100g: { calories: 170, protein: 4.5, carbs: 28, fat: 4, sugar: 1.5, fiber: 1, sodium: 350 }, servingSizes: [{ label: '2 pieces', grams: 120 }], defaultServing: { label: '2 pieces', grams: 120 }, healthScore: 7, dataSource: 'manual', isVerified: true },

  // North Indian
  { name: 'Chapati / Roti', nameHindi: 'रोटी', category: 'north_indian', region: 'North India', tags: ['vegetarian', 'whole_grain'], nutritionPer100g: { calories: 297, protein: 8.7, carbs: 56, fat: 3.7, sugar: 0.4, fiber: 5.5, sodium: 290 }, servingSizes: [{ label: '1 chapati', grams: 35 }, { label: '2 chapati', grams: 70 }], defaultServing: { label: '1 chapati', grams: 35 }, healthScore: 8, dataSource: 'manual', isVerified: true },
  { name: 'Dal Tadka', nameHindi: 'दाल तड़का', category: 'north_indian', region: 'North India', tags: ['vegetarian', 'high_protein', 'high_fiber'], nutritionPer100g: { calories: 90, protein: 5, carbs: 11, fat: 2.5, sugar: 1.5, fiber: 3, sodium: 340 }, servingSizes: [{ label: '1 bowl (200g)', grams: 200 }], defaultServing: { label: '1 bowl', grams: 200 }, healthScore: 9, dataSource: 'manual', isVerified: true },
  { name: 'Paneer Butter Masala', category: 'north_indian', region: 'North India', tags: ['vegetarian', 'high_fat', 'restaurant'], nutritionPer100g: { calories: 198, protein: 8, carbs: 9, fat: 15, sugar: 5, fiber: 1, sodium: 410 }, servingSizes: [{ label: '1 bowl (200g)', grams: 200 }], defaultServing: { label: '1 bowl', grams: 200 }, healthScore: 5, dataSource: 'manual', isVerified: true },
  { name: 'Chole', nameHindi: 'छोले', category: 'north_indian', region: 'Punjab', tags: ['vegetarian', 'high_protein', 'high_fiber'], nutritionPer100g: { calories: 130, protein: 7, carbs: 18, fat: 3, sugar: 1.5, fiber: 6, sodium: 380 }, servingSizes: [{ label: '1 bowl', grams: 200 }], defaultServing: { label: '1 bowl', grams: 200 }, healthScore: 8, dataSource: 'manual', isVerified: true },
  { name: 'Rajma', nameHindi: 'राजमा', category: 'north_indian', region: 'Punjab', tags: ['vegetarian', 'high_protein', 'high_fiber'], nutritionPer100g: { calories: 130, protein: 8, carbs: 21, fat: 1, sugar: 1, fiber: 7, sodium: 290 }, servingSizes: [{ label: '1 bowl', grams: 200 }], defaultServing: { label: '1 bowl', grams: 200 }, healthScore: 9, dataSource: 'manual', isVerified: true },
  { name: 'Aloo Paratha', nameHindi: 'आलू पराठा', category: 'north_indian', region: 'Punjab', tags: ['vegetarian'], nutritionPer100g: { calories: 264, protein: 5.6, carbs: 38, fat: 10, sugar: 1, fiber: 3, sodium: 380 }, servingSizes: [{ label: '1 paratha', grams: 100 }], defaultServing: { label: '1 paratha', grams: 100 }, healthScore: 5, dataSource: 'manual', isVerified: true },
  { name: 'Palak Paneer', category: 'north_indian', region: 'North India', tags: ['vegetarian', 'iron_rich', 'calcium_rich'], nutritionPer100g: { calories: 150, protein: 7, carbs: 7, fat: 10, sugar: 2, fiber: 2, sodium: 350 }, servingSizes: [{ label: '1 bowl', grams: 200 }], defaultServing: { label: '1 bowl', grams: 200 }, healthScore: 8, dataSource: 'manual', isVerified: true },

  // Rice dishes
  { name: 'Steamed Rice', nameHindi: 'चावल', nameTamil: 'சாதம்', category: 'indian_lunch', tags: ['vegetarian', 'gluten_free'], nutritionPer100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, sugar: 0, fiber: 0.4, sodium: 5 }, servingSizes: [{ label: '1 katori (100g)', grams: 100 }, { label: '1 plate (200g)', grams: 200 }], defaultServing: { label: '1 katori', grams: 100 }, healthScore: 6, dataSource: 'manual', isVerified: true },
  { name: 'Chicken Biryani', nameHindi: 'चिकन बिरयानी', category: 'indian_lunch', region: 'Hyderabad', tags: ['non_vegetarian', 'high_calorie'], nutritionPer100g: { calories: 290, protein: 15, carbs: 30, fat: 11, sugar: 1.5, fiber: 1, sodium: 620 }, servingSizes: [{ label: '1 plate (350g)', grams: 350 }], defaultServing: { label: '1 plate', grams: 350 }, healthScore: 5, warnings: ['high_sodium'], dataSource: 'manual', isVerified: true },
  { name: 'Vegetable Biryani', category: 'indian_lunch', region: 'Hyderabad', tags: ['vegetarian'], nutritionPer100g: { calories: 180, protein: 4, carbs: 30, fat: 5, sugar: 2, fiber: 2.5, sodium: 520 }, servingSizes: [{ label: '1 plate (300g)', grams: 300 }], defaultServing: { label: '1 plate', grams: 300 }, healthScore: 6, dataSource: 'manual', isVerified: true },
  { name: 'Khichdi', nameHindi: 'खिचड़ी', category: 'indian_dinner', tags: ['vegetarian', 'easy_digest', 'low_fat'], nutritionPer100g: { calories: 100, protein: 4, carbs: 18, fat: 1.5, sugar: 0.5, fiber: 2, sodium: 280 }, servingSizes: [{ label: '1 bowl (250g)', grams: 250 }], defaultServing: { label: '1 bowl', grams: 250 }, healthScore: 9, dataSource: 'manual', isVerified: true },

  // Snacks & Street Food
  { name: 'Samosa', category: 'street_food', region: 'North India', tags: ['vegetarian', 'fried', 'high_fat'], nutritionPer100g: { calories: 308, protein: 6, carbs: 32, fat: 17, sugar: 2, fiber: 3, sodium: 520 }, servingSizes: [{ label: '1 piece (60g)', grams: 60 }], defaultServing: { label: '1 piece', grams: 60 }, healthScore: 3, warnings: ['high_fat', 'fried'], dataSource: 'manual', isVerified: true },
  { name: 'Vada Pav', category: 'street_food', region: 'Maharashtra', tags: ['vegetarian', 'street_food'], nutritionPer100g: { calories: 210, protein: 5.5, carbs: 30, fat: 7.5, sugar: 2.5, fiber: 2, sodium: 480 }, servingSizes: [{ label: '1 piece (120g)', grams: 120 }], defaultServing: { label: '1 piece', grams: 120 }, healthScore: 4, dataSource: 'manual', isVerified: true },
  { name: 'Pani Puri / Gol Gappa', category: 'street_food', tags: ['vegetarian', 'street_food'], nutritionPer100g: { calories: 150, protein: 3.5, carbs: 25, fat: 3.5, sugar: 4, fiber: 2, sodium: 350 }, servingSizes: [{ label: '6 pieces', grams: 80 }], defaultServing: { label: '6 pieces', grams: 80 }, healthScore: 4, dataSource: 'manual', isVerified: true },
  { name: 'Masala Chai', nameHindi: 'मसाला चाय', category: 'indian_beverage', tags: ['vegetarian', 'beverage'], nutritionPer100g: { calories: 45, protein: 1.5, carbs: 7, fat: 1.5, sugar: 6.5, fiber: 0, sodium: 50 }, servingSizes: [{ label: '1 cup (150ml)', grams: 150 }], defaultServing: { label: '1 cup', grams: 150 }, healthScore: 5, dataSource: 'manual', isVerified: true },

  // Sweets
  { name: 'Gulab Jamun', category: 'indian_sweet', tags: ['vegetarian', 'high_sugar', 'dessert'], nutritionPer100g: { calories: 385, protein: 5.5, carbs: 53, fat: 17, sugar: 42, fiber: 0.5, sodium: 120 }, servingSizes: [{ label: '1 piece (35g)', grams: 35 }], defaultServing: { label: '1 piece', grams: 35 }, healthScore: 2, warnings: ['high_sugar', 'high_calorie'], dataSource: 'manual', isVerified: true },
  { name: 'Rasgulla', category: 'indian_sweet', tags: ['vegetarian', 'high_sugar'], nutritionPer100g: { calories: 186, protein: 4, carbs: 38, fat: 2, sugar: 34, fiber: 0, sodium: 80 }, servingSizes: [{ label: '1 piece (50g)', grams: 50 }], defaultServing: { label: '1 piece', grams: 50 }, healthScore: 3, warnings: ['high_sugar'], dataSource: 'manual', isVerified: true },
  { name: 'Kheer', nameHindi: 'खीर', category: 'indian_sweet', tags: ['vegetarian', 'high_sugar'], nutritionPer100g: { calories: 130, protein: 4, carbs: 20, fat: 4, sugar: 16, fiber: 0.2, sodium: 90 }, servingSizes: [{ label: '1 bowl (150g)', grams: 150 }], defaultServing: { label: '1 bowl', grams: 150 }, healthScore: 4, dataSource: 'manual', isVerified: true },

  // Proteins
  { name: 'Boiled Egg', category: 'other', tags: ['non_vegetarian', 'high_protein', 'low_carb'], nutritionPer100g: { calories: 155, protein: 13, carbs: 1.1, fat: 11, sugar: 0.6, fiber: 0, sodium: 124, cholesterol: 373 }, servingSizes: [{ label: '1 egg', grams: 50 }], defaultServing: { label: '1 egg', grams: 50 }, healthScore: 8, dataSource: 'manual', isVerified: true },
  { name: 'Grilled Chicken', category: 'meat', tags: ['non_vegetarian', 'high_protein', 'low_fat'], nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6, sugar: 0, fiber: 0, sodium: 74 }, servingSizes: [{ label: '1 piece (100g)', grams: 100 }, { label: 'Half breast (150g)', grams: 150 }], defaultServing: { label: '1 piece', grams: 100 }, healthScore: 9, dataSource: 'manual', isVerified: true },
];

async function seedDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    if (process.argv.includes('--destroy')) {
      await FoodItem.deleteMany({});
      await User.deleteMany({ role: { $ne: 'admin' } });
      console.log('🗑️  Database cleared');
      process.exit(0);
    }

    // Seed foods
    await FoodItem.deleteMany({ dataSource: 'manual', isVerified: true });
    await FoodItem.insertMany(indianFoods);
    console.log(`✅ Seeded ${indianFoods.length} Indian food items`);

    // Create admin user
    const existing = await User.findOne({ email: 'admin@nutritrack.ai' });
    if (!existing) {
      await User.create({
        name:            'Admin',
        email:           'admin@nutritrack.ai',
        password:        'Admin@123456',
        role:            'admin',
        isEmailVerified: true,
        authProvider:    'local'
      });
      console.log('✅ Admin user created: admin@nutritrack.ai / Admin@123456');
    }

    console.log('\n🎉 Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

seedDB();
