const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

// ─── Email Templates ──────────────────────────────────────────────────
const templates = {
  verifyEmail: (data) => ({
    subject: 'Verify your NutriTrack AI email',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8faf7;border-radius:12px">
        <div style="text-align:center;margin-bottom:24px">
          <span style="font-size:2rem;font-weight:800;color:#1a9e5c">NutriTrack AI</span>
        </div>
        <h2 style="color:#1a2e1a;font-size:1.4rem">Hi ${data.name}! 👋</h2>
        <p style="color:#6b7c6b;line-height:1.6">Welcome to NutriTrack AI! Please verify your email to start your nutrition journey.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${data.verifyUrl}" style="background:#1a9e5c;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem">Verify Email</a>
        </div>
        <p style="color:#6b7c6b;font-size:.85rem">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
      </div>
    `
  }),

  resetPassword: (data) => ({
    subject: 'Reset your NutriTrack AI password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8faf7;border-radius:12px">
        <h2 style="color:#1a2e1a">Password Reset 🔐</h2>
        <p style="color:#6b7c6b;line-height:1.6">Hi ${data.name}, click below to reset your password. This link is valid for 30 minutes.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${data.resetUrl}" style="background:#ef4444;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
        </div>
        <p style="color:#6b7c6b;font-size:.85rem">If you didn't request this, your account is safe — just ignore this email.</p>
      </div>
    `
  }),

  weeklyReport: (data) => ({
    subject: `Your NutriTrack Weekly Report 📊`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8faf7;border-radius:12px">
        <h2 style="color:#1a2e1a">Weekly Nutrition Summary 🥗</h2>
        <p style="color:#6b7c6b">Hi ${data.name}! Here's how you did this week:</p>
        <div style="background:white;border-radius:8px;padding:16px;margin:16px 0">
          <p>🔥 Streak: <strong>${data.streak} days</strong></p>
          <p>🍽️ Avg Calories: <strong>${data.avgCalories} kcal</strong></p>
          <p>💪 Avg Protein: <strong>${data.avgProtein}g</strong></p>
          <p>⚠️ Avg Sugar: <strong>${data.avgSugar}g</strong></p>
          <p>⭐ Health Score: <strong>${data.avgScore}/100</strong></p>
        </div>
        <p style="color:#6b7c6b">${data.aiReport}</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${process.env.CLIENT_URL}/dashboard" style="background:#1a9e5c;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">View Full Report</a>
        </div>
      </div>
    `
  })
};

// ─── Send Email ────────────────────────────────────────────────────────
exports.sendEmail = async ({ to, subject, template, data, html }) => {
  try {
    const transport = getTransporter();
    const tmpl = template && templates[template] ? templates[template](data) : null;

    await transport.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to,
      subject: subject || tmpl?.subject,
      html:    html    || tmpl?.html
    });
  } catch (err) {
    console.error('Email error:', err.message);
    throw err;
  }
};

// ─── Send weekly digest to all opted-in users ─────────────────────────
exports.sendWeeklyDigests = async () => {
  const User    = require('../models/User');
  const FoodLog = require('../models/FoodLog');

  const users = await User.find({
    isActive: true,
    'notifications.weeklyReport': true,
    'subscription.plan': { $ne: 'free' }  // Premium only
  }).limit(500);

  const since = new Date(); since.setDate(since.getDate() - 7);

  let sent = 0;
  for (const user of users) {
    try {
      const logs = await FoodLog.find({ user: user._id, date: { $gte: since } });
      if (!logs.length) continue;

      const avgCalories = Math.round(logs.reduce((s, l) => s + (l.totals?.calories || 0), 0) / logs.length);
      const avgProtein  = Math.round(logs.reduce((s, l) => s + (l.totals?.protein  || 0), 0) / logs.length);
      const avgSugar    = Math.round(logs.reduce((s, l) => s + (l.totals?.sugar    || 0), 0) / logs.length);
      const avgScore    = Math.round(logs.reduce((s, l) => s + (l.healthScore       || 0), 0) / logs.length);

      await exports.sendEmail({
        to: user.email,
        template: 'weeklyReport',
        data: {
          name: user.name,
          streak: user.streak.current,
          avgCalories, avgProtein, avgSugar, avgScore,
          aiReport: `You logged ${logs.length}/7 days this week. Keep up the great work!`
        }
      });
      sent++;
      await new Promise(r => setTimeout(r, 100)); // Throttle
    } catch {}
  }
  console.log(`Weekly digests sent: ${sent}`);
};
