const https = require('https');
const FoodLog = require('../models/FoodLog');
const User = require('../models/User');
const { AIRecommendation } = require('../models/Goal');

// ─── Helper: call Anthropic Claude API ────────────────────────────────
function callClaude(systemPrompt, userMessage, maxTokens = 800) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.content?.[0]?.text || '');
        } catch { reject(new Error('Failed to parse Claude response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Build nutrition context for AI ───────────────────────────────────
async function buildUserContext(userId) {
  const user = await User.findById(userId);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const log = await FoodLog.findOne({ user: userId, date: today });

  return {
    name:         user.name,
    goal:         user.fitnessGoal,
    dietType:     user.dietType,
    targets:      user.dailyTargets,
    conditions:   user.healthConditions,
    allergies:    user.allergies,
    todayTotals:  log?.totals || {},
    mealCount:    log?.entries?.length || 0,
    bmi:          user.getBMI()
  };
}

// ─── POST /api/ai/chat ─────────────────────────────────────────────────
exports.chat = async (req, res, next) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    // Free users: limit to 10 messages/day (implement with Redis in production)
    const ctx = await buildUserContext(req.user._id);

    const systemPrompt = `You are NutriAI, a knowledgeable and friendly AI nutrition assistant for NutriTrack AI, an Indian nutrition app.

USER PROFILE:
- Name: ${ctx.name}
- Goal: ${ctx.goal?.replace(/_/g, ' ')}
- Diet type: ${ctx.dietType}
- Health conditions: ${ctx.conditions?.join(', ') || 'None'}
- Allergies: ${ctx.allergies?.join(', ') || 'None'}
- Today's intake: ${ctx.todayTotals.calories || 0} kcal, ${ctx.todayTotals.protein || 0}g protein, ${ctx.todayTotals.sugar || 0}g sugar
- Daily targets: ${ctx.targets.calories} kcal, ${ctx.targets.protein}g protein, ${ctx.targets.sugar}g sugar max

GUIDELINES:
- Specialise in Indian cuisine (North & South Indian, regional dishes)
- Give practical, specific advice with portion sizes in Indian units (katori, bowl, chapati count)
- Warn about excessive sugar/sodium in a caring way
- Suggest healthier Indian alternatives when relevant
- Keep responses concise (3-5 sentences unless asked for more)
- Use emojis naturally to make responses friendly
- NEVER give medical diagnoses; recommend consulting a doctor for medical concerns`;

    const messages = [
      ...conversationHistory.slice(-6), // Keep last 6 for context
      { role: 'user', content: message }
    ];

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({
        reply: `Hi ${ctx.name}! 👋 NutriAI is ready to help. Note: AI key not configured yet — please add ANTHROPIC_API_KEY to .env. Your current intake today is ${ctx.todayTotals.calories || 0} kcal. 🥗`,
        tokensUsed: 0
      });
    }

    const reply = await callClaude(systemPrompt, message);
    res.json({ reply });
  } catch (err) { next(err); }
};

// ─── POST /api/ai/analyze-image ────────────────────────────────────────
exports.analyzeImage = async (req, res, next) => {
  try {
    const { imageUrl, imageBase64, mealType = 'lunch' } = req.body;
    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ error: 'imageUrl or imageBase64 required' });
    }

    const ctx = await buildUserContext(req.user._id);

    const prompt = `Analyze this food image and identify all food items visible.
For each food item, provide:
1. Food name (use Indian food names where applicable)
2. Estimated portion size in grams
3. Estimated nutrition per the visible portion:
   - Calories (kcal)
   - Protein (g)
   - Carbs (g)
   - Fat (g)
   - Sugar (g)
   - Fiber (g)
4. Confidence level (0-1)

User context: ${ctx.dietType} diet, goal: ${ctx.goal}

Respond ONLY in this JSON format:
{
  "foods": [
    {
      "name": "string",
      "portionGrams": number,
      "servingLabel": "string (e.g. 1 bowl)",
      "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "sugar": 0, "fiber": 0 },
      "confidence": 0.0,
      "isIndianFood": true/false
    }
  ],
  "totalCalories": number,
  "mealType": "${mealType}",
  "healthNotes": "string",
  "aiSuggestion": "string"
}`;

    // Build message content with image
    const imageContent = imageBase64
      ? { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } }
      : { type: 'image', source: { type: 'url', url: imageUrl } };

    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: [imageContent, { type: 'text', text: prompt }]
      }]
    });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({
        analysis: {
          foods: [{ name: 'Detected Food', portionGrams: 200, servingLabel: '1 bowl', nutrition: { calories: 300, protein: 10, carbs: 40, fat: 8, sugar: 5, fiber: 3 }, confidence: 0.8 }],
          totalCalories: 300,
          healthNotes: 'Configure ANTHROPIC_API_KEY for real image analysis',
          aiSuggestion: 'Great meal choice!'
        }
      });
    }

    const options = {
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const data = await new Promise((resolve, reject) => {
      const r = https.request(options, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Parse error')); } });
      });
      r.on('error', reject); r.write(body); r.end();
    });

    const text = data.content?.[0]?.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Could not parse image' };

    res.json({ analysis });
  } catch (err) { next(err); }
};

// ─── GET /api/ai/meal-plan ─────────────────────────────────────────────
exports.getMealPlan = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const ctx = await buildUserContext(req.user._id);

    const prompt = `Create a ${days}-day Indian meal plan for a person with:
- Goal: ${ctx.goal?.replace(/_/g, ' ')}
- Diet: ${ctx.dietType}
- Daily calorie target: ${ctx.targets.calories} kcal
- Protein target: ${ctx.targets.protein}g
- Health conditions: ${ctx.conditions?.join(', ') || 'None'}
- Allergies: ${ctx.allergies?.join(', ') || 'None'}

Include:
- Breakfast, lunch, snack, dinner for each day
- All Indian foods with regional variety (South Indian, North Indian, etc.)
- Approximate calories and macros per meal
- Prep time
- Shopping list for the week

Format as JSON:
{
  "days": [
    {
      "day": 1,
      "dayName": "Monday",
      "meals": {
        "breakfast": { "name": "", "recipe": "", "calories": 0, "protein": 0, "prepMins": 0 },
        "lunch": { ... },
        "snack": { ... },
        "dinner": { ... }
      },
      "totalCalories": 0,
      "totalProtein": 0
    }
  ],
  "shoppingList": ["item1", "item2"],
  "tips": ["tip1"]
}`;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ mealPlan: { error: 'Configure ANTHROPIC_API_KEY for meal plans' } });
    }

    const text = await callClaude('You are an expert Indian nutritionist. Respond only in valid JSON.', prompt, 2000);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const mealPlan = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Could not generate plan' };

    // Save as recommendation
    await AIRecommendation.create({
      user: req.user._id,
      type: 'meal_plan',
      title: `${days}-Day Meal Plan`,
      content: `Personalised ${days}-day Indian meal plan for ${ctx.goal?.replace(/_/g, ' ')}`,
      data: mealPlan,
      priority: 'high',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    res.json({ mealPlan });
  } catch (err) { next(err); }
};

// ─── GET /api/ai/weekly-report ─────────────────────────────────────────
exports.weeklyReport = async (req, res, next) => {
  try {
    const since = new Date(); since.setDate(since.getDate() - 7); since.setHours(0, 0, 0, 0);
    const logs = await FoodLog.find({ user: req.user._id, date: { $gte: since } }).sort({ date: 1 });
    const user = await User.findById(req.user._id);

    if (logs.length === 0) {
      return res.json({ report: { message: 'Not enough data for a weekly report. Start logging meals!' } });
    }

    const avgCalories = Math.round(logs.reduce((s, l) => s + (l.totals?.calories || 0), 0) / logs.length);
    const avgProtein  = Math.round(logs.reduce((s, l) => s + (l.totals?.protein  || 0), 0) / logs.length);
    const avgSugar    = Math.round(logs.reduce((s, l) => s + (l.totals?.sugar    || 0), 0) / logs.length);
    const avgScore    = Math.round(logs.reduce((s, l) => s + (l.healthScore       || 0), 0) / logs.length);

    const summary = {
      daysLogged: logs.length,
      avgCalories, avgProtein, avgSugar, avgScore,
      calorieTarget: user.dailyTargets.calories,
      proteinTarget: user.dailyTargets.protein,
      sugarLimit:    user.dailyTargets.sugar,
      streak:        user.streak.current
    };

    const prompt = `Generate a weekly nutrition report for:
${JSON.stringify(summary, null, 2)}

Write a friendly, encouraging report (3-4 paragraphs) covering:
1. Overall performance vs targets
2. What they did well
3. Areas to improve
4. Specific actionable tips for next week (Indian food focused)

Keep it motivating, specific, and practical. Use emojis.`;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ summary, report: 'Configure ANTHROPIC_API_KEY for AI weekly reports.' });
    }

    const report = await callClaude('You are a caring Indian nutrition coach writing a weekly progress report.', prompt, 600);
    res.json({ summary, report });
  } catch (err) { next(err); }
};

// ─── GET /api/ai/suggestions ───────────────────────────────────────────
exports.getSuggestions = async (req, res, next) => {
  try {
    const recs = await AIRecommendation.find({
      user: req.user._id,
      isRead: false,
      $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }]
    }).sort({ priority: -1, createdAt: -1 }).limit(5);

    res.json({ suggestions: recs });
  } catch (err) { next(err); }
};

// ─── POST /api/ai/analyze-food-log ─────────────────────────────────────
exports.analyzeFoodLog = async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const log = await FoodLog.findOne({ user: req.user._id, date: today });
    const user = await User.findById(req.user._id);

    if (!log || log.entries.length === 0) {
      return res.json({ analysis: "You haven't logged any food today. Start by logging your breakfast! 🥣" });
    }

    const foods = log.entries.map(e => `${e.foodName} (${e.portionSize}${e.portionUnit}, ${e.nutrition?.calories || 0} kcal)`).join(', ');
    const prompt = `Quick analysis of today's food log for someone with goal: ${user.fitnessGoal?.replace(/_/g, ' ')}

Foods eaten: ${foods}
Total: ${log.totals.calories} kcal, ${log.totals.protein}g protein, ${log.totals.sugar}g sugar
Targets: ${user.dailyTargets.calories} kcal, ${user.dailyTargets.protein}g protein, ${user.dailyTargets.sugar}g sugar max

Give a 2-3 sentence encouraging analysis with one specific suggestion for the rest of the day.`;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ analysis: `You've logged ${log.entries.length} meals totaling ${log.totals.calories} kcal. Keep going! 💪` });
    }

    const analysis = await callClaude('You are NutriAI, a friendly Indian nutrition assistant.', prompt, 200);
    res.json({ analysis });
  } catch (err) { next(err); }
};
