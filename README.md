# 📚 PDF Notes Platform
### A secure, role-based PDF sharing platform for coaching institutes

---

## 🏗️ Project Structure

```
pdf-notes-platform/
├── backend/
│   ├── controllers/
│   │   ├── authController.js     # Login, logout, session handling
│   │   ├── adminController.js    # User management, stats
│   │   └── pdfController.js      # Upload, stream, delete PDFs
│   ├── middleware/
│   │   ├── auth.js               # JWT auth + device check
│   │   └── upload.js             # Multer file upload config
│   ├── models/
│   │   ├── User.js               # User schema (admin/student)
│   │   ├── PDF.js                # PDF metadata schema
│   │   └── AccessLog.js          # Activity log schema
│   ├── routes/
│   │   ├── auth.js               # /api/auth/*
│   │   ├── admin.js              # /api/admin/*
│   │   ├── student.js            # /api/student/*
│   │   └── pdf.js                # /api/pdf/*
│   ├── uploads/                  # PDF files stored here (gitignored)
│   ├── server.js                 # Express app entry point
│   ├── package.json
│   └── .env.example              # Environment variable template
│
└── frontend/
    ├── index.html                # Login page (root)
    ├── shared/
    │   ├── common.css            # Shared design system
    │   ├── api.js                # Authenticated API client
    │   └── device.js             # Device fingerprinting
    ├── admin/
    │   ├── dashboard.html        # Admin control panel
    │   ├── admin.css
    │   └── admin.js
    └── student/
        ├── dashboard.html        # Student notes listing
        └── viewer.html           # Secure PDF viewer (PDF.js)
```

---

## ⚡ Local Setup (Step by Step)

### Prerequisites
- Node.js v18+ → https://nodejs.org
- MongoDB (local) → https://www.mongodb.com/try/download/community
  **OR** MongoDB Atlas (free cloud) → https://cloud.mongodb.com

---

### Step 1: Clone / Extract the project
```bash
# If you downloaded a zip, extract it.
# Navigate into the project:
cd pdf-notes-platform
```

### Step 2: Install backend dependencies
```bash
cd backend
npm install
```

### Step 3: Configure environment
```bash
# Copy the example env file
cp .env.example .env

# Open .env and edit:
# - MONGO_URI: your MongoDB connection string
# - JWT_SECRET: change to a long random string
# - ADMIN_PASSWORD: change the default admin password
```

Your `.env` file:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/pdf-notes-platform
JWT_SECRET=replace_this_with_a_very_long_random_secret_key_32chars_min
JWT_EXPIRES_IN=8h
ADMIN_ID=admin
ADMIN_PASSWORD=Admin@1234
MAX_FILE_SIZE_MB=50
FRONTEND_URL=http://localhost:3000
```

### Step 4: Create the uploads folder
```bash
mkdir -p backend/uploads
```

### Step 5: Start the backend
```bash
# From the backend/ folder:
npm run dev      # Development (auto-restart)
# OR
npm start        # Production
```

You'll see:
```
✅ MongoDB connected successfully
👤 Default admin created → ID: admin | Password: Admin@1234
🚀 Server running on http://localhost:5000
```

### Step 6: Serve the frontend
The backend serves the frontend statically. Open your browser:
```
http://localhost:5000
```

### Step 7: Login as Admin
- **User ID:** `admin`
- **Password:** `Admin@1234`
- ⚠️ Change this password immediately after first login!

---

## 👤 How to Use

### As Admin:
1. **Login** with admin credentials
2. **Create students** → Students tab → Fill form → Create
3. **Approve students** → Students tab → Click ✅ Approve
4. **Upload PDFs** → PDF Files tab → Fill title + choose file → Upload
5. **Manage**: Block/unblock users, delete PDFs, reset device bindings

### As Student:
1. Get your **User ID and Password** from admin
2. Login at the platform URL
3. First login **binds your device** — you cannot login from another device
4. Browse and read PDFs (no download option)

---

## 🔐 Security Features

| Feature | Implementation |
|---|---|
| No self-registration | Students can only be created by admin |
| Approval required | Admin must approve before login |
| Device binding | First login fingerprints the device |
| Single session | New login invalidates old session |
| JWT with token ID | Each session has a unique token ID |
| Secure PDF streaming | PDF served via API, real filename never exposed |
| No download button | PDF.js in canvas mode, toolbar hidden |
| Right-click disabled | `contextmenu` prevented on student pages |
| Text selection blocked | CSS + JS user-select disabled |
| Tab switch blur | Content blurred when user switches tabs |
| PrintScreen detection | Overlay shown on PrintScreen key |
| Watermark | User ID watermarked on every PDF page |
| Rate limiting | 5 login attempts per 15 min per IP |
| Helmet.js | Security HTTP headers |

---

## 🚀 Deployment Guide

### Option A: Railway (Recommended — Easiest)

1. Push code to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables in Railway dashboard (Settings → Variables)
5. Add MongoDB plugin: Railway dashboard → New → Database → MongoDB
6. Copy the `MONGO_URL` Railway provides into your `MONGO_URI` variable
7. Railway auto-deploys on push

### Option B: Render.com

1. Push to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. **Build Command:** `cd backend && npm install`
5. **Start Command:** `cd backend && npm start`
6. Add environment variables in Render dashboard
7. For MongoDB: use MongoDB Atlas (free tier)

**MongoDB Atlas Setup:**
1. https://cloud.mongodb.com → Create free cluster
2. Database Access → Add user with password
3. Network Access → Allow All (0.0.0.0/0)
4. Connect → Drivers → Copy connection string
5. Replace `<password>` in the string and use as `MONGO_URI`

### Option C: Vercel (Frontend) + Railway (Backend)

Since this is a monolith, use Railway for the full stack.
For split deployment:
- Backend: Railway/Render
- Frontend: Vercel (set `FRONTEND_URL` to your Vercel domain in backend env)

---

## 🌐 Production Checklist

- [ ] Change `ADMIN_PASSWORD` in `.env`
- [ ] Set a strong `JWT_SECRET` (32+ random characters)
- [ ] Set `NODE_ENV=production`
- [ ] Use MongoDB Atlas (not local MongoDB)
- [ ] Set `FRONTEND_URL` to your actual domain
- [ ] Enable HTTPS (Railway/Render/Vercel do this automatically)
- [ ] Set `JWT_EXPIRES_IN` to a reasonable value (e.g., `8h`)
- [ ] Store `.env` in your deployment platform's secret variables — never commit it to git

---

## 📡 API Reference

### Auth
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login with userId + password |
| POST | `/api/auth/logout` | Auth | Invalidate session |
| GET | `/api/auth/me` | Auth | Get current user |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/users` | List all students |
| POST | `/api/admin/users` | Create student |
| PATCH | `/api/admin/users/:id/approve` | Approve student |
| PATCH | `/api/admin/users/:id/block` | Block/unblock student |
| PATCH | `/api/admin/users/:id/reset-device` | Reset device binding |
| DELETE | `/api/admin/users/:id` | Delete student |

### PDF
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/pdf/list` | Auth | List PDFs |
| POST | `/api/pdf/upload` | Admin | Upload a PDF |
| GET | `/api/pdf/stream/:id` | Auth | Secure stream PDF |
| PATCH | `/api/pdf/:id/toggle` | Admin | Show/hide PDF |
| DELETE | `/api/pdf/:id` | Admin | Delete PDF |

---

## 🛟 Troubleshooting

**MongoDB connection fails?**
- Make sure MongoDB is running: `sudo systemctl start mongod` (Linux) or start MongoDB Compass
- Check your `MONGO_URI` in `.env`

**Students can't login after creation?**
- Admin must **approve** the student first from the Students tab

**Student locked to wrong device?**
- Admin: Students tab → find user → click 📱 Reset Device

**PDF not loading in viewer?**
- Check browser console for errors
- Ensure the backend is running and the PDF file exists in `backend/uploads/`

**Upload fails?**
- File must be PDF format
- Check file size (default max: 50MB)

---

## 📝 License
MIT — free to use and modify.
