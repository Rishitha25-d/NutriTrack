const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailHelper');

// ─── Token Helpers ────────────────────────────────────────────────────
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
  });
  return { accessToken, refreshToken };
};

// ─── POST /api/auth/register ──────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, fitnessGoal, gender, height, weight, dateOfBirth } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const emailVerifyToken = crypto.randomBytes(32).toString('hex');

    const user = await User.create({
      name, email, password,
      fitnessGoal: fitnessGoal || 'maintain',
      gender, height, weight, dateOfBirth,
      emailVerifyToken
    });

    // Send verification email
    try {
      await sendEmail({
        to: email,
        subject: 'Verify your NutriTrack AI account',
        template: 'verifyEmail',
        data: {
          name,
          verifyUrl: `${process.env.CLIENT_URL}/verify-email/${emailVerifyToken}`
        }
      });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      message: 'Account created! Please verify your email.',
      accessToken,
      refreshToken,
      user: user.toPublicJSON()
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password +refreshToken');

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated. Contact support.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: user.toPublicJSON()
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/logout ────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/refresh ───────────────────────────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json(tokens);
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(err);
  }
};

// ─── GET /api/auth/verify-email/:token ───────────────────────────────
exports.verifyEmail = async (req, res, next) => {
  try {
    const user = await User.findOne({ emailVerifyToken: req.params.token });
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });

    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'Email verified! You can now log in.' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/resend-verification ──────────────────────────────
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.isEmailVerified) {
      return res.json({ message: 'If this email exists and is unverified, we sent a link.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    user.emailVerifyToken = token;
    await user.save({ validateBeforeSave: false });
    await sendEmail({
      to: email,
      subject: 'Verify your NutriTrack AI account',
      template: 'verifyEmail',
      data: { name: user.name, verifyUrl: `${process.env.CLIENT_URL}/verify-email/${token}` }
    });
    res.json({ message: 'Verification email sent.' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/forgot-password ──────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    // Always send same response (security)
    const successMsg = { message: 'If that email exists, a reset link was sent.' };
    if (!user) return res.json(successMsg);

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 min
    await user.save({ validateBeforeSave: false });

    await sendEmail({
      to: user.email,
      subject: 'Reset your NutriTrack AI password',
      template: 'resetPassword',
      data: {
        name: user.name,
        resetUrl: `${process.env.CLIENT_URL}/reset-password/${token}`
      }
    });

    res.json(successMsg);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/reset-password/:token ────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.refreshToken = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/auth/google/callback ───────────────────────────────────
exports.googleCallback = async (req, res) => {
  const { accessToken, refreshToken } = generateTokens(req.user._id);
  req.user.refreshToken = refreshToken;
  await req.user.save({ validateBeforeSave: false });
  // Redirect to frontend with tokens
  res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${accessToken}&refresh=${refreshToken}`);
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ user: user.toPublicJSON() });
};
