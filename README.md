# NutriTrack AI — Backend API

> Production-ready Node.js + Express + MongoDB backend for the NutriTrack AI nutrition tracking platform.

---

## 📁 Folder Structure

```
nutritrack-backend/
├── src/
│   ├── server.js                    # Entry point
│   ├── config/
│   │   └── passport.js              # JWT + Google OAuth
│   ├── models/
│   │   ├── User.js                  # Users, profiles, goals
│   │   ├── FoodLog.js               # Daily meal logs
│   │   ├── FoodItem.js              # Food database
│   │   └── Goal.js                  # Goals + AI recommendations
│   ├── routes/
│   │   ├── auth.js                  # /api/auth
│   │   ├── users.js                 # /api/users
│   │   ├── foodLogs.js              # /api/food-logs
│   │   ├── nutrition.js             # /api/nutrition
│   │   ├── barcode.js               # /api/barcode
│   │   ├── ai.js                    # /api/ai
│   │   ├── goals.js                 # /api/goals
│   │   ├── analytics.js             # /api/analytics
│   │   ├── upload.js                # /api/upload
│   │   ├── admin.js                 # /api/admin
│   │   └── payments.js              # /api/payments
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── usersController.js
│   │   ├── foodLogsController.js
│   │   ├── nutritionController.js
│   │   ├── barcodeController.js
│   │   └── aiController.js
│   ├── middleware/
│   │   └── auth.js                  # protect, adminOnly, premiumOnly
│   └── utils/
│       ├── nutritionHelper.js       # Health scoring, Indian food DB
│       ├── emailHelper.js           # Nodemailer + templates
│       ├── streakHelper.js          # Daily streak cron
│       └── seeder.js                # Seed Indian foods
├── .env.example
├── package.json
└── README.md
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
# Fill in all values in .env
```

**Minimum required for basic operation:**
```env
MONGODB_URI=mongodb://localhost:27017/nutritrack
JWT_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
PORT=5000
CLIENT_URL=http://localhost:3000
```

### 3. Seed the database (Indian foods + admin user)
```bash
npm run seed
```

### 4. Start the server
```bash
npm run dev     # Development (with nodemon)
npm start       # Production
```

Server starts at: `http://localhost:5000`
Health check: `http://localhost:5000/health`

---

## 🔑 API Reference

### Authentication (`/api/auth`)

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/register` | Create account | ❌ |
| POST | `/login` | Email/password login | ❌ |
| POST | `/logout` | Logout (revoke token) | ✅ |
| POST | `/refresh` | Refresh access token | ❌ |
| GET  | `/google` | Google OAuth redirect | ❌ |
| GET  | `/google/callback` | Google OAuth callback | ❌ |
| GET  | `/verify-email/:token` | Verify email | ❌ |
| POST | `/forgot-password` | Send reset email | ❌ |
| POST | `/reset-password/:token` | Reset password | ❌ |
| GET  | `/me` | Get current user | ✅ |

### Food Logs (`/api/food-logs`)

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/` | Today's log | ✅ |
| GET | `/date/:date` | Log for specific date (YYYY-MM-DD) | ✅ |
| GET | `/range?start=&end=` | Logs for date range | ✅ |
| POST | `/entry` | Add food entry | ✅ |
| PUT | `/entry/:id` | Update entry | ✅ |
| DELETE | `/entry/:id` | Remove entry | ✅ |
| PUT | `/water` | Update water intake | ✅ |
| GET | `/history?days=30` | Log history | ✅ |

**Add entry payload:**
```json
{
  "foodName": "Masala Dosa",
  "portionSize": 160,
  "portionUnit": "g",
  "mealType": "breakfast",
  "nutrition": {
    "calories": 213,
    "protein": 5.4,
    "carbs": 35,
    "fat": 5.9,
    "sugar": 1.3
  },
  "source": "search"
}
```

### Nutrition Search (`/api/nutrition`)

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/search?q=dosa&page=1` | Search food database | ✅ |
| GET | `/item/:id` | Get food item details | ✅ |
| GET | `/indian?category=south_indian` | Indian food list | ✅ |
| GET | `/usda/:query` | Search USDA database | ✅ |
| GET | `/edamam/:query` | Search Edamam | ✅ |

### Barcode (`/api/barcode`)

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/:barcode` | Look up product by barcode | ✅ |

### AI Features (`/api/ai`)

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/chat` | Free | Chat with NutriAI |
| POST | `/analyze-image` | Premium | Identify food from photo |
| GET | `/meal-plan?days=7` | Premium | Generate weekly meal plan |
| GET | `/weekly-report` | Premium | AI-written weekly summary |
| GET | `/suggestions` | Free | Unread AI recommendations |
| POST | `/analyze-food-log` | Free | Analyse today's intake |

**Chat payload:**
```json
{
  "message": "What should I eat for lunch under 400 kcal?",
  "conversationHistory": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous reply" }
  ]
}
```

### Analytics (`/api/analytics`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/summary?period=week` | Avg calories, macros, score |
| GET | `/macros?period=week` | Macro breakdown |
| GET | `/streaks` | Streak + badges |
| GET | `/nutrients?date=YYYY-MM-DD` | Micronutrients for a day |
| GET | `/top-foods` | Most logged foods (30 days) |

### Payments (`/api/payments`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/create-order` | Create Razorpay order |
| POST | `/verify` | Verify payment signature |
| GET  | `/subscription` | Current subscription |
| POST | `/cancel` | Cancel subscription |

**Create order payload:**
```json
{ "plan": "premium" }
```

---

## 🔒 Authentication

All protected routes require:
```
Authorization: Bearer <accessToken>
```

**Token refresh:**
```bash
POST /api/auth/refresh
{ "refreshToken": "..." }
```

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (32+ chars) |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token secret |
| `PORT` | ❌ | Server port (default: 5000) |
| `ANTHROPIC_API_KEY` | ❌ | Claude AI (chat, image, reports) |
| `GOOGLE_CLIENT_ID` | ❌ | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ❌ | Google OAuth |
| `USDA_API_KEY` | ❌ | USDA FoodData Central |
| `EDAMAM_APP_ID` | ❌ | Edamam food search |
| `EDAMAM_APP_KEY` | ❌ | Edamam food search |
| `CLOUDINARY_CLOUD_NAME` | ❌ | Image uploads |
| `CLOUDINARY_API_KEY` | ❌ | Image uploads |
| `CLOUDINARY_API_SECRET` | ❌ | Image uploads |
| `SMTP_HOST` | ❌ | Email (Gmail SMTP) |
| `SMTP_USER` | ❌ | Email username |
| `SMTP_PASS` | ❌ | Email app password |
| `RAZORPAY_KEY_ID` | ❌ | Payments |
| `RAZORPAY_KEY_SECRET` | ❌ | Payments |

---

## 🌐 Deployment

### Railway / Render / Fly.io
```bash
# Set all env vars in dashboard, then:
npm start
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### PM2 (VPS)
```bash
npm install -g pm2
pm2 start src/server.js --name nutritrack-api
pm2 save && pm2 startup
```

---

## 🧪 Test Endpoints

```bash
# Health check
curl http://localhost:5000/health

# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Priya","email":"priya@test.com","password":"Test@12345"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"priya@test.com","password":"Test@12345"}'

# Search Indian foods (replace TOKEN)
curl http://localhost:5000/api/nutrition/indian \
  -H "Authorization: Bearer TOKEN"

# Barcode lookup
curl http://localhost:5000/api/barcode/8901058851427 \
  -H "Authorization: Bearer TOKEN"
```

---

## 🍽️ Seeded Data

The seeder adds **25+ verified Indian foods** including:
- South Indian: Idli, Dosa, Sambar, Upma, Poha, Rava Idli
- North Indian: Chapati, Dal, Paneer, Chole, Rajma, Paratha
- Rice: Biryani, Khichdi, Steamed Rice
- Street Food: Samosa, Vada Pav, Pani Puri
- Sweets: Gulab Jamun, Rasgulla, Kheer
- Proteins: Eggs, Grilled Chicken

Admin: `admin@nutritrack.ai` / `Admin@123456`

---

Built with ❤️ for India — NutriTrack AI © 2025
