// Required Modules
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

// Load .env variables
dotenv.config();

// Express Setup
const app = express();
const PORT = process.env.PORT || 3000;

// Admin Credentials from .env
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD;

// MongoDB Report Schema
const reportSchema = new mongoose.Schema({
  originalName: String,
  filename: String,
  uploadedAt: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', reportSchema);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(session({
  secret: 'journal_secret_key',
  resave: false,
  saveUninitialized: true
}));

// Global isAdmin flag
app.use((req, res, next) => {
  res.locals.isAdmin = req.session.adminLoggedIn || false;
  next();
});

// Auth Middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.adminLoggedIn) return next();
  return res.redirect('/admin/login');
}

// Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'public/uploads/reports';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// ================== ROUTES ==================

// Home Page (Public)
app.get('/', (req, res) => {
  res.render('index');
});

// Admin Login
app.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null });
});

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (username === ADMIN_USERNAME && match) {
    req.session.adminLoggedIn = true;
    return res.redirect('/admin/report-upload');
  } else {
    return res.render('admin-login', { error: 'Invalid credentials' });
  }
});

// Admin Logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// Report Upload Page (Admin only)
app.get('/admin/report-upload', isAuthenticated, (req, res) => {
  res.render('report-upload');
});

// Handle Report Upload
app.post('/admin/report-upload', isAuthenticated, upload.single('pdf'), async (req, res) => {
  const report = new Report({
    originalName: req.file.originalname,
    filename: req.file.filename
  });
  await report.save();
  res.redirect('/admin/reports');
});

// Reports Listing (Public Viewable)
app.get('/admin/reports', async (req, res) => {
  const reports = await Report.find().sort({ uploadedAt: -1 });
  res.render('reports', { reports });
});

// File Download
app.get('/uploads/reports/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'uploads', 'reports', req.params.filename);
  res.download(filePath);
});

// ================== START SERVER ==================
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.error('MongoDB connection error:', err));
