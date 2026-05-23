const router = require('express').Router();
const https  = require('https');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

router.use(protect);

const PLANS = {
  premium:    { amount: 29900, name: 'NutriTrack Premium', duration: 30 },  // ₹299 in paise
  pro_family: { amount: 59900, name: 'NutriTrack Pro Family', duration: 30 }
};

// POST /api/payments/create-order
router.post('/create-order', async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });
    if (!process.env.RAZORPAY_KEY_ID) {
      return res.status(503).json({ error: 'Payment gateway not configured' });
    }

    const orderData = JSON.stringify({
      amount:   PLANS[plan].amount,
      currency: 'INR',
      receipt:  `rcpt_${req.user._id}_${Date.now()}`,
      notes:    { userId: req.user._id.toString(), plan }
    });

    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const options = {
      hostname: 'api.razorpay.com', path: '/v1/orders', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(orderData)
      }
    };

    const order = await new Promise((resolve, reject) => {
      const r = https.request(options, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Parse error')); } });
      });
      r.on('error', reject); r.write(orderData); r.end();
    });

    res.json({
      orderId: order.id,
      amount:  PLANS[plan].amount,
      currency:'INR',
      keyId:   process.env.RAZORPAY_KEY_ID,
      planName: PLANS[plan].name,
      user: { name: req.user.name, email: req.user.email }
    });
  } catch (err) { next(err); }
});

// POST /api/payments/verify
router.post('/verify', async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (PLANS[plan]?.duration || 30));

    await User.findByIdAndUpdate(req.user._id, {
      'subscription.plan':      plan,
      'subscription.status':    'active',
      'subscription.startDate': new Date(),
      'subscription.endDate':   endDate,
      'subscription.razorpaySubId': razorpay_payment_id,
      $inc: { points: 100 }  // Bonus points for subscribing
    });

    res.json({
      message: `Successfully upgraded to ${plan}! Enjoy your premium features.`,
      subscription: { plan, endDate }
    });
  } catch (err) { next(err); }
});

// GET /api/payments/subscription
router.get('/subscription', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('subscription');
    res.json({ subscription: user.subscription });
  } catch (err) { next(err); }
});

// POST /api/payments/cancel
router.post('/cancel', async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      'subscription.status': 'cancelled'
    });
    res.json({ message: 'Subscription cancelled. Access continues until end date.' });
  } catch (err) { next(err); }
});

module.exports = router;
