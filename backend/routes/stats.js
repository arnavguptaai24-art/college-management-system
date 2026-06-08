const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/stats
router.get('/', (req, res) => {
  try {
    // 1. Total Students
    const studentCountResult = db.prepare('SELECT COUNT(*) as count FROM students').get();
    const totalStudents = studentCountResult ? studentCountResult.count : 0;

    // 2. Total Faculty
    const facultyCountResult = db.prepare('SELECT COUNT(*) as count FROM faculty').get();
    const totalFaculty = facultyCountResult ? facultyCountResult.count : 0;

    // 3. Average Marks
    const avgMarksResult = db.prepare('SELECT AVG(marks) as avg FROM students').get();
    const avgMarks = avgMarksResult && avgMarksResult.avg !== null 
      ? Math.round(avgMarksResult.avg * 100) / 100 
      : 0;

    // 3.5. Average Attendance
    const avgAttendanceResult = db.prepare(`
      SELECT 
        (CAST(SUM(CASE WHEN status IN ('Present', 'Late') THEN 1 ELSE 0 END) AS REAL) / COUNT(*)) * 100 as avg_att
      FROM attendance
    `).get();
    const avgAttendance = avgAttendanceResult && avgAttendanceResult.avg_att !== null
      ? Math.round(avgAttendanceResult.avg_att * 100) / 100
      : 100.0;

    // 4. Department Breakdown (Faculty count by department)
    const departmentBreakdown = db.prepare(`
      SELECT department, COUNT(*) as count 
      FROM faculty 
      GROUP BY department
    `).all();

    // 5. Course Breakdown (Students count by course) - needed for Chart.js
    const courseBreakdown = db.prepare(`
      SELECT course, COUNT(*) as count 
      FROM students 
      GROUP BY course
    `).all();

    // 6. Recent Additions Feed (merge 5 latest students and 5 latest faculty)
    const recentStudents = db.prepare(`
      SELECT 'student' as type, id, name, course as details, created_at 
      FROM students 
      ORDER BY id DESC 
      LIMIT 5
    `).all();

    const recentFaculty = db.prepare(`
      SELECT 'faculty' as type, id, name, department as details, created_at 
      FROM faculty 
      ORDER BY id DESC 
      LIMIT 5
    `).all();

    // Combine and sort by created_at DESC (or by ID/timestamp)
    const recentAdditions = [...recentStudents, ...recentFaculty]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    return res.json({
      totalStudents,
      totalFaculty,
      avgMarks,
      avgAttendance,
      departmentBreakdown,
      courseBreakdown,
      recentAdditions
    });
  } catch (err) {
    console.error('Error computing dashboard statistics:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
