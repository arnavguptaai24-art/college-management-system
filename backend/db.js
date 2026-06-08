const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

// Initialize database file
const dbPath = path.resolve(__dirname, 'cms.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'viewer'))
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    usn TEXT UNIQUE NOT NULL,
    course TEXT NOT NULL,
    semester INTEGER NOT NULL,
    section TEXT NOT NULL,
    marks REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    subject TEXT NOT NULL,
    salary REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Late')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(student_id, date)
  );
`);

// Seed function
function seedDatabase() {
  // Check and seed admin user
  const userCountResult = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const userCount = userCountResult ? userCountResult.count : 0;
  if (userCount === 0) {
    console.log('Seeding admin user...');
    const adminPasswordHash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run('admin', adminPasswordHash, 'admin');
  }

  // Check and seed students
  const studentCountResult = db.prepare('SELECT COUNT(*) as count FROM students').get();
  const studentCount = studentCountResult ? studentCountResult.count : 0;
  if (studentCount === 0) {
    console.log('Seeding sample students...');
    const insertStudent = db.prepare(`
      INSERT INTO students (name, usn, course, semester, section, marks)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const sampleStudents = [
      ['Rahul Sharma', '1BM22ML001', 'Machine Learning', 6, 'A', 88.5],
      ['Ananya Iyer', '1BM22ML002', 'Machine Learning', 6, 'A', 92.0],
      ['Aditya Hegde', '1BM22ML003', 'Machine Learning', 6, 'B', 79.5],
      ['Sneha Patel', '1BM23ML010', 'Machine Learning', 4, 'A', 85.0],
      ['Vikram Singh', '1BM23ML015', 'Machine Learning', 4, 'B', 90.5]
    ];

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const student of sampleStudents) {
        insertStudent.run(...student);
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  // Check and seed faculty
  const facultyCountResult = db.prepare('SELECT COUNT(*) as count FROM faculty').get();
  const facultyCount = facultyCountResult ? facultyCountResult.count : 0;
  if (facultyCount === 0) {
    console.log('Seeding sample faculty members...');
    const insertFaculty = db.prepare(`
      INSERT INTO faculty (name, employee_id, department, subject, salary)
      VALUES (?, ?, ?, ?, ?)
    `);

    const sampleFaculty = [
      ['Dr. Latha Prasad', 'FML001', 'Machine Learning', 'Deep Learning', 120000.0],
      ['Dr. Rajesh Gowda', 'FML002', 'Machine Learning', 'Linear Algebra', 115000.0],
      ['Prof. Sunitha M.', 'FML003', 'Machine Learning', 'Probability & Statistics', 98000.0]
    ];

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const member of sampleFaculty) {
        insertFaculty.run(...member);
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  // Check and seed attendance
  const attendanceCountResult = db.prepare('SELECT COUNT(*) as count FROM attendance').get();
  const attendanceCount = attendanceCountResult ? attendanceCountResult.count : 0;
  if (attendanceCount === 0) {
    console.log('Seeding sample attendance logs...');
    
    // Fetch seeded student IDs
    const studentRows = db.prepare('SELECT id, name FROM students').all();
    
    // Create logs for 5 dates: 2026-06-01 to 2026-06-05
    const dates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
    
    const insertAttendance = db.prepare(`
      INSERT INTO attendance (student_id, date, status)
      VALUES (?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const student of studentRows) {
        for (let idx = 0; idx < dates.length; idx++) {
          const date = dates[idx];
          let status = 'Present';

          // Add variations for seed metrics
          if (student.name === 'Rahul Sharma' && idx === 2) status = 'Absent';
          if (student.name === 'Aditya Hegde' && (idx === 1 || idx === 3)) status = 'Absent';
          if (student.name === 'Sneha Patel' && idx === 4) status = 'Late';

          insertAttendance.run(student.id, date, status);
        }
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }
}

// Seed the database
seedDatabase();

module.exports = db;
