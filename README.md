# CMS — BMS College of Engineering

A fully-fledged, responsive, full-stack College Management System web application developed for **BMS College of Engineering, Department of Machine Learning**. 

This system manages student academic records and faculty records digitally, featuring full CRUD operations, JWT authorization policy layers, synchronous SQLite queries, and a modern single-page application (SPA) dashboard.

---

## 🌟 Key Features

### Backend
- **RESTful API Engine**: Built on Node.js and Express.js.
- **Persistent Storage**: Utilizes SQLite (via `better-sqlite3`) to enforce reliable database storage.
- **Access Authentication**: Protected routes secured via JSON Web Tokens (JWT) and `bcrypt` password hashing.
- **System Metrics Aggregations**: Generates statistics on registrations, class average grades, course distributions, and recent registry updates.

### Frontend (SPA)
- **Academic Theme Aesthetics**: "Modern Academic Dark" styling using rich dark-navies, glowing cards, micro-animations, and animated mesh background gradients.
- **Dashboard Summary**: Features a distribution bar chart powered by Chart.js.
- **Unified Interfaces**: Responsive layout containing modals for editing/registration, filter bars, custom paginated tables, and live toast notifications.
- **Client OOP Engine**: Utilizes ES6 classes mirroring original Java OOP models.

---

## 📂 Project Structure

```
college-management-system/
├── backend/
│   ├── server.js           (Main Express server configuration)
│   ├── db.js               (SQLite database connection, schema setup & seed)
│   ├── routes/
│   │   ├── auth.js         (Authentication endpoints for session management)
│   │   ├── students.js     (Student CRUD routes & query filters)
│   │   ├── faculty.js      (Faculty CRUD routes & query filters)
│   │   └── stats.js        (Aggregated dashboard metrics & logs)
│   ├── middleware/
│   │   └── auth.js         (JWT verification middleware)
│   └── package.json        (Backend configuration and packages)
├── frontend/
│   ├── index.html          (Main HTML template container)
│   ├── style.css           (Custom styling detailing layout & components)
│   └── app.js              (SPA router, HTTP Client, and OOP models)
└── README.md
```

---

## ⚙️ Setup and Installation

### Prerequisites
Ensure you have **Node.js** (v16+) installed.

### Installation & Execution
1. Open a terminal inside the project directory:
   ```bash
   cd college-management-system/backend
   ```
2. Install required dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 📖 API Documentation

| Endpoint | HTTP Method | Authentication | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | None | Validates username & password; returns a JWT token. |
| `/api/auth/logout` | `POST` | None | Terminates session (stateless notification). |
| `/api/students` | `GET` | None | Lists students. Supports filters (`search`, `course`, `semester`, `section`) and pagination. |
| `/api/students/:id` | `GET` | None | Gets details of a single student. |
| `/api/students` | `POST` | **Admin Only** | Registers a new student. |
| `/api/students/:id` | `PUT` | **Admin Only** | Updates an existing student record. |
| `/api/students/:id` | `DELETE` | **Admin Only** | Purges a student record. |
| `/api/faculty` | `GET` | None | Lists faculty profiles. Supports filters (`search`, `department`) and pagination. |
| `/api/faculty/:id` | `GET` | None | Gets details of a single faculty member. |
| `/api/faculty` | `POST` | **Admin Only** | Registers a new faculty employee. |
| `/api/faculty/:id` | `PUT` | **Admin Only** | Updates an existing faculty member. |
| `/api/faculty/:id` | `DELETE` | **Admin Only** | Purges a faculty member profile. |
| `/api/stats` | `GET` | None | Aggregates campus metrics (student counts, course chart, recent logs). |

---

## 🧑‍💻 Team Contribution Matrix

Matching the original system report allocations:

| Team Member | Contribution Details |
| :--- | :--- |
| **Adithya Reddy** | Project Planning, Architecture Diagrams, Documentation |
| **Daksha Gupta** | Class Design, Database Schema Modeling, Logic Flow Diagrams |
| **Arnav Gupta** | Full Stack Implementation (Backend APIs + SPA Frontend), Testing & QA, Debugging |

---

## 📐 OOP Concept Implementations (Frontend JS)

To maintain parity with the original Java desktop application design, the JavaScript frontend utilizes ES6 classes to manage records:

1. **Inheritance**: 
   A parent class `Person` is defined in [app.js](file:///d:/Java%20aat/college-management-system/frontend/app.js) containing shared properties (`id`, `name`, `createdAt`). Both `Student` and `Faculty` inherit from this class:
   ```javascript
   class Student extends Person { ... }
   class Faculty extends Person { ... }
   ```
2. **Encapsulation**:
   Academic structures and calculations are encapsulated directly inside their respective classes (e.g. `Student.getFormattedMarks()` and `Faculty.getFormattedSalary()`), exposing a clean interface to the rendering methods.
3. **Polymorphism**:
   Helper methods are overridden dynamically based on instances to handle calculations specific to student grades vs. faculty payroll.

---

## 🖼️ Application Interfaces (Screenshots Placeholder)

### 1. Security Authentication Gate
*(Login Card with BMSCE Crest authentication prompt)*

### 2. Main System Dashboard
*(Total counts metrics, Chart.js Student distribution bar chart, and Recent Activities stream)*

### 3. Student Academic Registry
*(Dynamic paginated data tables with active filters and CRUD modal selectors)*
