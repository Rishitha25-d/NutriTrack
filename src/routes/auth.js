const router = require('express').Router();
const passport = require('passport');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password needs uppercase, lowercase & number')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// ─── Local Auth ──────────────────────────────────────────────────────
router.post('/register', registerValidation, authController.register);
router.post('/login',    loginValidation,    authController.login);
router.post('/logout',   protect,            authController.logout);
router.post('/refresh',                      authController.refreshToken);

// ─── Email Verification ──────────────────────────────────────────────
router.get('/verify-email/:token',           authController.verifyEmail);
router.post('/resend-verification',          authController.resendVerification);

// ─── Password Reset ──────────────────────────────────────────────────
router.post('/forgot-password', [body('email').isEmail()], authController.forgotPassword);
router.post('/reset-password/:token', [
  body('password').isLength({ min: 8 })
], authController.resetPassword);

// ─── Google OAuth ────────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=google_failed` }),
  authController.googleCallback
);

// ─── Get current user ────────────────────────────────────────────────
router.get('/me', protect, authController.getMe);

module.exports = router;
