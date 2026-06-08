const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// GET /api/faculty - List all faculty (with search, filter, and pagination)
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM faculty';
    let countQuery = 'SELECT COUNT(*) as count FROM faculty';
    let whereClauses = [];
    let params = [];

    // Search query param
    if (req.query.search) {
      whereClauses.push('(name LIKE ? OR employee_id LIKE ? OR department LIKE ? OR subject LIKE ?)');
      const val = `%${req.query.search}%`;
      params.push(val, val, val, val);
    }

    // Filter query param
    if (req.query.department) {
      whereClauses.push('department = ?');
      params.push(req.query.department);
    }

    if (whereClauses.length > 0) {
      const whereStr = ' WHERE ' + whereClauses.join(' AND ');
      query += whereStr;
      countQuery += whereStr;
    }

    // Order by newest additions first
    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';

    const countResult = db.prepare(countQuery).get(params);
    const total = countResult ? countResult.count : 0;

    const faculty = db.prepare(query).all(...params, limit, offset);

    return res.json({
      faculty,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (err) {
    console.error('Error fetching faculty:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/faculty/:id - Get faculty member by ID
router.get('/:id', (req, res) => {
  try {
    const member = db.prepare('SELECT * FROM faculty WHERE id = ?').get(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Faculty member not found.' });
    }
    return res.json(member);
  } catch (err) {
    console.error('Error fetching faculty:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/faculty - Add faculty (Auth required)
router.post('/', authenticateToken, (req, res) => {
  const { name, employee_id, department, subject, salary } = req.body;

  if (!name || !employee_id || !department || !subject || salary === undefined) {
    return res.status(400).json({ error: 'All fields (name, employee_id, department, subject, salary) are required.' });
  }

  try {
    // Check if employee_id exists
    const existing = db.prepare('SELECT id FROM faculty WHERE employee_id = ?').get(employee_id);
    if (existing) {
      return res.status(400).json({ error: `Employee ID '${employee_id}' is already registered.` });
    }

    const info = db.prepare(`
      INSERT INTO faculty (name, employee_id, department, subject, salary)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, employee_id.toUpperCase(), department, subject, parseFloat(salary));

    const newFaculty = db.prepare('SELECT * FROM faculty WHERE id = ?').get(info.lastInsertRowid);
    return res.status(201).json({
      message: 'Faculty member added successfully.',
      faculty: newFaculty
    });
  } catch (err) {
    console.error('Error adding faculty:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/faculty/:id - Update faculty (Auth required)
router.put('/:id', authenticateToken, (req, res) => {
  const { name, employee_id, department, subject, salary } = req.body;

  if (!name || !employee_id || !department || !subject || salary === undefined) {
    return res.status(400).json({ error: 'All fields (name, employee_id, department, subject, salary) are required.' });
  }

  try {
    const member = db.prepare('SELECT id FROM faculty WHERE id = ?').get(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Faculty member not found.' });
    }

    // Check if updated employee_id conflicts with another member
    const existing = db.prepare('SELECT id FROM faculty WHERE employee_id = ? AND id != ?').get(employee_id, req.params.id);
    if (existing) {
      return res.status(400).json({ error: `Employee ID '${employee_id}' is already in use by another faculty member.` });
    }

    db.prepare(`
      UPDATE faculty
      SET name = ?, employee_id = ?, department = ?, subject = ?, salary = ?
      WHERE id = ?
    `).run(name, employee_id.toUpperCase(), department, subject, parseFloat(salary), req.params.id);

    const updatedFaculty = db.prepare('SELECT * FROM faculty WHERE id = ?').get(req.params.id);
    return res.json({
      message: 'Faculty member updated successfully.',
      faculty: updatedFaculty
    });
  } catch (err) {
    console.error('Error updating faculty:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/faculty/:id - Delete faculty (Auth required)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const member = db.prepare('SELECT id FROM faculty WHERE id = ?').get(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Faculty member not found.' });
    }

    db.prepare('DELETE FROM faculty WHERE id = ?').run(req.params.id);
    return res.json({ message: 'Faculty member deleted successfully.' });
  } catch (err) {
    console.error('Error deleting faculty:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
