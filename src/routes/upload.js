const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const { protect, premiumOnly } = require('../middleware/auth');

// ─── Multer: memory storage (then upload to Cloudinary) ───────────────
const storage = multer.memoryStorage();
const upload  = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  }
});

router.use(protect);

// POST /api/upload/food-image
router.post('/food-image', premiumOnly, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    // Upload to Cloudinary
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
      api_key:     process.env.CLOUDINARY_API_KEY,
      api_secret:  process.env.CLOUDINARY_API_SECRET
    });

    const base64 = req.file.buffer.toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder:         'nutritrack/food-images',
      transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
      public_id:      `food_${req.user._id}_${Date.now()}`
    });

    res.json({
      imageUrl:  result.secure_url,
      publicId:  result.public_id,
      width:     result.width,
      height:    result.height,
      base64:    base64.substring(0, 100) + '...'  // For AI analysis
    });
  } catch (err) { next(err); }
});

// POST /api/upload/avatar
router.post('/avatar', upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const dataURI = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result  = await cloudinary.uploader.upload(dataURI, {
      folder:         'nutritrack/avatars',
      transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }],
      public_id:      `avatar_${req.user._id}`
    });

    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, { avatar: result.secure_url });

    res.json({ avatarUrl: result.secure_url });
  } catch (err) { next(err); }
});

module.exports = router;
