const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// GET /api/students - List all students (with search, filter, and pagination)
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    let query = `
      SELECT s.*, 
             COUNT(a.id) as total_classes,
             SUM(CASE WHEN a.status IN ('Present', 'Late') THEN 1 ELSE 0 END) as attended_classes
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
    `;
    let countQuery = 'SELECT COUNT(*) as count FROM students';
    let whereClauses = [];
    let params = [];

    // Search query param
    if (req.query.search) {
      whereClauses.push('(name LIKE ? OR usn LIKE ? OR course LIKE ? OR section LIKE ?)');
      const val = `%${req.query.search}%`;
      params.push(val, val, val, val);
    }

    // Filter query params
    if (req.query.course) {
      whereClauses.push('course = ?');
      params.push(req.query.course);
    }

    if (req.query.semester) {
      whereClauses.push('semester = ?');
      params.push(parseInt(req.query.semester));
    }

    if (req.query.section) {
      whereClauses.push('section = ?');
      params.push(req.query.section);
    }

    if (whereClauses.length > 0) {
      const whereStr = ' WHERE ' + whereClauses.join(' AND ');
      query += whereStr;
      countQuery += whereStr;
    }

    // Order by newest additions first
    query += ' GROUP BY s.id ORDER BY s.id DESC LIMIT ? OFFSET ?';

    const countResult = db.prepare(countQuery).get(params);
    const total = countResult ? countResult.count : 0;

    const students = db.prepare(query).all(...params, limit, offset);

    return res.json({
      students,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (err) {
    console.error('Error fetching students:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/students/:id - Get student by ID
router.get('/:id', (req, res) => {
  try {
    const student = db.prepare(`
      SELECT s.*, 
             COUNT(a.id) as total_classes,
             SUM(CASE WHEN a.status IN ('Present', 'Late') THEN 1 ELSE 0 END) as attended_classes
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
      WHERE s.id = ?
      GROUP BY s.id
    `).get(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    return res.json(student);
  } catch (err) {
    console.error('Error fetching student:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/students - Add student (Auth required)
router.post('/', authenticateToken, (req, res) => {
  const { name, usn, course, semester, section, marks } = req.body;

  if (!name || !usn || !course || semester === undefined || !section || marks === undefined) {
    return res.status(400).json({ error: 'All fields (name, usn, course, semester, section, marks) are required.' });
  }

  try {
    // Check if USN exists
    const existing = db.prepare('SELECT id FROM students WHERE usn = ?').get(usn);
    if (existing) {
      return res.status(400).json({ error: `USN '${usn}' is already registered.` });
    }

    const info = db.prepare(`
      INSERT INTO students (name, usn, course, semester, section, marks)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, usn.toUpperCase(), course, parseInt(semester), section.toUpperCase(), parseFloat(marks));

    const newStudent = db.prepare(`
      SELECT s.*, 
             COUNT(a.id) as total_classes,
             SUM(CASE WHEN a.status IN ('Present', 'Late') THEN 1 ELSE 0 END) as attended_classes
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
      WHERE s.id = ?
      GROUP BY s.id
    `).get(info.lastInsertRowid);
    return res.status(201).json({
      message: 'Student added successfully.',
      student: newStudent
    });
  } catch (err) {
    console.error('Error adding student:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/students/:id - Update student (Auth required)
router.put('/:id', authenticateToken, (req, res) => {
  const { name, usn, course, semester, section, marks } = req.body;

  if (!name || !usn || !course || semester === undefined || !section || marks === undefined) {
    return res.status(400).json({ error: 'All fields (name, usn, course, semester, section, marks) are required.' });
  }

  try {
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Check if updated USN conflicts with another student
    const existing = db.prepare('SELECT id FROM students WHERE usn = ? AND id != ?').get(usn, req.params.id);
    if (existing) {
      return res.status(400).json({ error: `USN '${usn}' is already in use by another student.` });
    }

    db.prepare(`
      UPDATE students
      SET name = ?, usn = ?, course = ?, semester = ?, section = ?, marks = ?
      WHERE id = ?
    `).run(name, usn.toUpperCase(), course, parseInt(semester), section.toUpperCase(), parseFloat(marks), req.params.id);

    const updatedStudent = db.prepare(`
      SELECT s.*, 
             COUNT(a.id) as total_classes,
             SUM(CASE WHEN a.status IN ('Present', 'Late') THEN 1 ELSE 0 END) as attended_classes
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
      WHERE s.id = ?
      GROUP BY s.id
    `).get(req.params.id);
    return res.json({
      message: 'Student updated successfully.',
      student: updatedStudent
    });
  } catch (err) {
    console.error('Error updating student:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/students/:id - Delete student (Auth required)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
    return res.json({ message: 'Student deleted successfully.' });
  } catch (err) {
    console.error('Error deleting student:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
