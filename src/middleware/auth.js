const passport = require('passport');

exports.protect = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ error: info?.message || 'Unauthorized. Please log in.' });
    }
    req.user = user;
    next();
  })(req, res, next);
};

exports.adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

exports.premiumOnly = (req, res, next) => {
  const plan = req.user?.subscription?.plan;
  if (plan === 'free') {
    return res.status(403).json({ error: 'Upgrade to Premium to use this feature.', upgrade: true });
  }
  next();
};
