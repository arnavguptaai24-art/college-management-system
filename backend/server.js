const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const facultyRoutes = require('./routes/faculty');
const statsRoutes = require('./routes/stats');
const attendanceRoutes = require('./routes/attendance');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/attendance', attendanceRoutes);

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../frontend')));

// Fallback to index.html for frontend routing (SPA support)
app.get('*', (req, res) => {
  // If requesting api routes that don't exist, return 404
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

// Start Server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(` CMS Server is running on http://localhost:${PORT}`);
    console.log(` Serving frontend from: ${path.join(__dirname, '../frontend')}`);
    console.log(`===================================================`);
  });
}

module.exports = app;
