const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// GET /api/attendance - Get attendance sheet for a class on a specific date
router.get('/', (req, res) => {
  const { date, course, semester, section } = req.query;

  if (!date || !course || !semester || !section) {
    return res.status(400).json({ error: 'Parameters (date, course, semester, section) are required.' });
  }

  try {
    // Left join dynamically retrieves the marked status of each student for the date
    const query = `
      SELECT s.id, s.name, s.usn, s.course, s.semester, s.section, a.status
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ?
      WHERE s.course = ? AND s.semester = ? AND s.section = ?
      ORDER BY s.name ASC
    `;

    const sheet = db.prepare(query).all(date, course, parseInt(semester), section);
    return res.json(sheet);
  } catch (err) {
    console.error('Error fetching attendance sheet:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/attendance/batch - Submit attendance records in a batch (Auth required)
router.post('/batch', authenticateToken, (req, res) => {
  const { date, records } = req.body;

  if (!date || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Date and records array are required.' });
  }

  try {
    const insertOrReplace = db.prepare(`
      INSERT OR REPLACE INTO attendance (student_id, date, status)
      VALUES (?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const rec of records) {
        if (rec.student_id && rec.status) {
          insertOrReplace.run(parseInt(rec.student_id), date, rec.status);
        }
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    return res.json({
      message: `Successfully updated attendance for ${records.length} students on ${date}.`
    });
  } catch (err) {
    console.error('Error saving batch attendance:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
