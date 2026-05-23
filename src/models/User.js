const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // ─── Auth ──────────────────────────────────────────────────────────
  name:             { type: String, required: true, trim: true },
  email:            { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:         { type: String, select: false },
  googleId:         { type: String },
  authProvider:     { type: String, enum: ['local', 'google'], default: 'local' },
  isEmailVerified:  { type: Boolean, default: false },
  emailVerifyToken: String,
  resetPasswordToken:   String,
  resetPasswordExpire:  Date,
  refreshToken:     { type: String, select: false },

  // ─── Profile ───────────────────────────────────────────────────────
  avatar:     String,
  phone:      String,
  dateOfBirth: Date,
  gender:     { type: String, enum: ['male', 'female', 'other', ''] },
  height:     { type: Number }, // cm
  weight:     { type: Number }, // kg
  targetWeight: Number,

  // ─── Fitness Goal ──────────────────────────────────────────────────
  fitnessGoal: {
    type: String,
    enum: ['weight_loss', 'muscle_gain', 'maintain', 'diabetes_friendly', 'keto', 'high_protein'],
    default: 'maintain'
  },
  activityLevel: {
    type: String,
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    default: 'moderate'
  },

  // ─── Daily Targets (auto-calculated or custom) ─────────────────────
  dailyTargets: {
    calories: { type: Number, default: 2000 },
    protein:  { type: Number, default: 120 },   // g
    carbs:    { type: Number, default: 250 },    // g
    fat:      { type: Number, default: 65 },     // g
    sugar:    { type: Number, default: 50 },     // g
    fiber:    { type: Number, default: 25 },     // g
    sodium:   { type: Number, default: 2300 },   // mg
    water:    { type: Number, default: 8 }       // glasses
  },

  // ─── Health Conditions ─────────────────────────────────────────────
  healthConditions: [{
    type: String,
    enum: ['diabetes', 'hypertension', 'high_cholesterol', 'celiac', 'lactose_intolerant', 'none']
  }],
  allergies: [{ type: String }],

  // ─── Preferences ───────────────────────────────────────────────────
  dietType: {
    type: String,
    enum: ['vegetarian', 'vegan', 'non_vegetarian', 'eggetarian', 'jain'],
    default: 'non_vegetarian'
  },
  cuisinePreferences: [{ type: String }],

  // ─── Streak & Gamification ─────────────────────────────────────────
  streak: {
    current:  { type: Number, default: 0 },
    longest:  { type: Number, default: 0 },
    lastLogDate: Date
  },
  points:  { type: Number, default: 0 },
  badges:  [{ name: String, earnedAt: Date, icon: String }],
  level:   { type: Number, default: 1 },

  // ─── Subscription ──────────────────────────────────────────────────
  subscription: {
    plan:      { type: String, enum: ['free', 'premium', 'pro_family'], default: 'free' },
    status:    { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
    startDate: Date,
    endDate:   Date,
    razorpaySubId: String
  },

  // ─── Family ────────────────────────────────────────────────────────
  familyMembers: [{
    name:   String,
    age:    Number,
    gender: String,
    relation: String
  }],

  // ─── Notifications ─────────────────────────────────────────────────
  notifications: {
    mealReminders:   { type: Boolean, default: true },
    waterReminders:  { type: Boolean, default: true },
    weeklyReport:    { type: Boolean, default: true },
    streakAlerts:    { type: Boolean, default: true }
  },

  // ─── Meta ──────────────────────────────────────────────────────────
  isActive:   { type: Boolean, default: true },
  role:       { type: String, enum: ['user', 'admin'], default: 'user' },
  lastLogin:  Date
}, {
  timestamps: true
});

// ─── Indexes ──────────────────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });

// ─── Pre-save: hash password ──────────────────────────────────────────
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Methods ──────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getBMI = function() {
  if (!this.height || !this.weight) return null;
  const bmi = this.weight / Math.pow(this.height / 100, 2);
  return {
    value: Math.round(bmi * 10) / 10,
    category:
      bmi < 18.5 ? 'Underweight' :
      bmi < 25   ? 'Normal weight' :
      bmi < 30   ? 'Overweight' : 'Obese'
  };
};

userSchema.methods.calculateTDEE = function() {
  if (!this.weight || !this.height || !this.dateOfBirth || !this.gender) return 2000;
  const age = Math.floor((Date.now() - this.dateOfBirth) / 31557600000);
  // Mifflin-St Jeor formula
  let bmr = this.gender === 'male'
    ? 10 * this.weight + 6.25 * this.height - 5 * age + 5
    : 10 * this.weight + 6.25 * this.height - 5 * age - 161;

  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  return Math.round(bmr * (multipliers[this.activityLevel] || 1.55));
};

userSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.resetPasswordToken;
  delete obj.emailVerifyToken;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
