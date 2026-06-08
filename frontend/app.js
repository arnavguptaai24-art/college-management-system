/* ==========================================================================
   COLLEGE MANAGEMENT SYSTEM (CMS) - APP ENGINE
   BMS College of Engineering, Dept. of Machine Learning
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. OBJECT-ORIENTED PROGRAMMING (OOP) MODELS
// --------------------------------------------------------------------------

/**
 * Base Person class representing general details of any person in the campus.
 */
class Person {
  constructor(id, name, createdAt) {
    if (this.constructor === Person) {
      throw new Error("Abstract Class 'Person' cannot be directly instantiated.");
    }
    this.id = id;
    this.name = name;
    this.createdAt = createdAt;
  }

  /**
   * Helper method to output a simple string representation
   */
  toString() {
    return `${this.name} (ID: ${this.id})`;
  }
}

/**
 * Student Class extending Person, representing student academic records.
 */
class Student extends Person {
  constructor(id, name, usn, course, semester, section, marks, totalClasses, attendedClasses, createdAt) {
    super(id, name, createdAt);
    this.usn = usn;
    this.course = course;
    this.semester = semester;
    this.section = section;
    this.marks = parseFloat(marks);
    this.totalClasses = parseInt(totalClasses) || 0;
    this.attendedClasses = parseInt(attendedClasses) || 0;
  }

  /**
   * Return formatted marks as a percentage string
   */
  getFormattedMarks() {
    return `${this.marks.toFixed(2)}%`;
  }

  /**
   * Return formatted Sem and Section
   */
  getSemSec() {
    return `Sem ${this.semester} - ${this.section}`;
  }

  /**
   * Return formatted attendance as a percentage string
   */
  getFormattedAttendance() {
    if (this.totalClasses === 0) return '100% (0/0)';
    const pct = (this.attendedClasses / this.totalClasses) * 100;
    return `${pct.toFixed(0)}% (${this.attendedClasses}/${this.totalClasses})`;
  }
}

/**
 * Faculty Class extending Person, representing teacher employment records.
 */
class Faculty extends Person {
  constructor(id, name, employeeId, department, subject, salary, createdAt) {
    super(id, name, createdAt);
    this.employeeId = employeeId;
    this.department = department;
    this.subject = subject;
    this.salary = parseFloat(salary);
  }

  /**
   * Return formatted Indian Rupee monthly salary
   */
  getFormattedSalary() {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(this.salary);
  }
}

// --------------------------------------------------------------------------
// 2. CENTRAL STATE ARCHITECTURE
// --------------------------------------------------------------------------
const AppState = {
  // Credentials & Session
  token: localStorage.getItem('cms_jwt_token') || null,
  user: JSON.parse(localStorage.getItem('cms_user_data')) || null,

  // UI State
  currentView: 'dashboard',
  courseChartInstance: null,

  // Records Store
  students: [],
  faculty: [],
  stats: {},
  attendanceSheet: [],

  // Paginations & Query Filters
  studentFilters: {
    search: '',
    course: '',
    semester: '',
    section: '',
    page: 1,
    limit: 10
  },
  facultyFilters: {
    search: '',
    department: '',
    page: 1,
    limit: 10
  },

  // Modal contexts
  deleteContext: {
    type: null, // 'student' or 'faculty'
    id: null
  }
};

// Base API URL detection (works both when served locally or from custom ports)
const API_BASE_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:3000/api'
  : '/api';

// --------------------------------------------------------------------------
// 3. SECURED HTTP CLIENT (FETCH WRAPPER WITH TOAST INTEGRATION)
// --------------------------------------------------------------------------
async function makeApiRequest(endpoint, options = {}, showLoader = true) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Attach Authorization Header if token exists
  if (AppState.token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${AppState.token}`
    };
  }

  // Set Content-Type default to JSON if we pass a body
  if (options.body && !(options.body instanceof FormData)) {
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json'
    };
    if (typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  if (showLoader) {
    document.getElementById('loadingOverlay').classList.remove('hidden');
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      // Handle unauthorized expired token redirect
      if (response.status === 401) {
        showToast(data.error || 'Session expired. Please log in again.', 'error');
        handleLogoutAction();
        throw new Error('Unauthorized Session');
      }
      throw new Error(data.error || 'API Request failed');
    }

    return data;
  } catch (error) {
    if (error.message !== 'Unauthorized Session') {
      showToast(error.message || 'Network error connecting to CMS server.', 'error');
    }
    throw error;
  } finally {
    if (showLoader) {
      document.getElementById('loadingOverlay').classList.add('hidden');
    }
  }
}

// --------------------------------------------------------------------------
// 4. TOAST NOTIFICATION UTILITIES
// --------------------------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-octagon';
  if (type === 'warning') iconName = 'alert-triangle';

  toast.innerHTML = `
    <div class="toast-icon ${type}">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-message">${message}</div>
    <div class="toast-close">
      <i data-lucide="x"></i>
    </div>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  // Attach dismiss handler
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  });

  // Self dismiss timer
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.transform = 'translateX(120%)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}

// --------------------------------------------------------------------------
// 5. VIEW NAVIGATION ENGINE (SPA CONTROLLER)
// --------------------------------------------------------------------------
function initRouter() {
  const menuItems = document.querySelectorAll('.menu-item');
  
  // Event listener for sidebar links
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      navigateToView(targetView);
    });
  });

  // Restore view from URL Hash if applicable
  const hash = window.location.hash.replace('#', '');
  if (['dashboard', 'students', 'faculty', 'attendance', 'about'].includes(hash)) {
    navigateToView(hash);
  } else {
    navigateToView('dashboard');
  }
}

function navigateToView(viewName) {
  // Update state
  AppState.currentView = viewName;
  window.location.hash = viewName;

  // Toggle active styling in sidebar
  document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle visual views
  document.querySelectorAll('.view-section').forEach(section => {
    if (section.id === `view-${viewName}`) {
      section.classList.remove('hidden');
    } else {
      section.classList.add('hidden');
    }
  });

  // Update headers
  const titleMap = {
    dashboard: { main: 'Dashboard', sub: 'System Overview and Statistical Summaries' },
    students: { main: 'Student Directory', sub: 'Manage & Register Student Academics' },
    faculty: { main: 'Faculty Registry', sub: 'Manage Faculty Subject & Department Assignments' },
    attendance: { main: 'Class Attendance Ledger', sub: 'Record & Synchronize Daily Student Attendance' },
    about: { main: 'About System', sub: 'Project Specifications and Technical Architecture' }
  };

  const headerInfo = titleMap[viewName] || titleMap.dashboard;
  document.getElementById('pageTitle').textContent = headerInfo.main;
  document.getElementById('pageSubTitle').textContent = headerInfo.sub;

  // Refresh view specific data
  loadViewData(viewName);
}

function loadViewData(viewName) {
  if (viewName === 'dashboard') {
    fetchStatsAndDashboard();
  } else if (viewName === 'students') {
    fetchStudentsList();
  } else if (viewName === 'faculty') {
    fetchFacultyList();
  } else if (viewName === 'attendance') {
    initAttendanceView();
  }
}

// --------------------------------------------------------------------------
// 6. DASHBOARD & STATISTICS RENDERING
// --------------------------------------------------------------------------
async function fetchStatsAndDashboard() {
  try {
    const stats = await makeApiRequest('/stats', { method: 'GET' });
    AppState.stats = stats;

    // Render Metrics counts
    document.getElementById('statTotalStudents').textContent = stats.totalStudents;
    document.getElementById('statTotalFaculty').textContent = stats.totalFaculty;
    document.getElementById('statAvgMarks').textContent = `${stats.avgMarks.toFixed(2)}%`;
    document.getElementById('statAvgAttendance').textContent = `${stats.avgAttendance.toFixed(2)}%`;

    // Render Course Chart
    renderCourseDistributionChart(stats.courseBreakdown);

    // Render Recent Activities list
    renderRecentActivities(stats.recentAdditions);

  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function renderCourseDistributionChart(breakdown) {
  const ctx = document.getElementById('courseChart').getContext('2d');
  
  const labels = breakdown.map(item => item.course);
  const data = breakdown.map(item => item.count);

  if (AppState.courseChartInstance) {
    AppState.courseChartInstance.destroy();
  }

  // Create clean dark academic theme chart
  AppState.courseChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Enrolled Students',
        data: data,
        backgroundColor: 'rgba(47, 129, 247, 0.45)',
        borderColor: '#2f81f7',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(47, 129, 247, 0.7)',
        hoverBorderColor: '#58a6ff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#161b22',
          titleColor: '#f0f6fc',
          bodyColor: '#e3b341',
          bodyFont: { family: 'IBM Plex Mono' },
          borderColor: 'rgba(240, 246, 252, 0.1)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#8b949e',
            font: { family: 'Outfit', size: 12 }
          }
        },
        y: {
          grid: { color: 'rgba(240, 246, 252, 0.05)' },
          ticks: {
            color: '#8b949e',
            font: { family: 'IBM Plex Mono', size: 11 },
            stepSize: 1
          }
        }
      }
    }
  });
}

function renderRecentActivities(activities) {
  const list = document.getElementById('recentActivityList');
  list.innerHTML = '';

  if (activities.length === 0) {
    list.innerHTML = `<li class="feed-empty">No recent activities found</li>`;
    return;
  }

  activities.forEach(act => {
    const li = document.createElement('li');
    li.className = 'feed-item';

    const isStudent = act.type === 'student';
    const icon = isStudent ? 'user' : 'graduation-cap';
    const tag = isStudent ? 'Student' : 'Faculty';
    const details = isStudent ? `enrolled in ${act.details}` : `assigned to ${act.details} department`;
    
    // Relative times formatting
    const dateObj = new Date(act.created_at);
    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    li.innerHTML = `
      <div class="feed-icon ${act.type}">
        <i data-lucide="${icon}"></i>
      </div>
      <div class="feed-content">
        <p><strong>${act.name}</strong> (${tag}) ${details}</p>
        <span>Registered on campus records</span>
      </div>
      <div class="feed-time">${timeString}</div>
    `;
    list.appendChild(li);
  });

  lucide.createIcons();
}

// --------------------------------------------------------------------------
// 7. STUDENTS DIRECTORY LOGIC
// --------------------------------------------------------------------------
async function fetchStudentsList() {
  const filters = AppState.studentFilters;
  
  // Build query parameter URL
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.course) params.append('course', filters.course);
  if (filters.semester) params.append('semester', filters.semester);
  if (filters.section) params.append('section', filters.section);
  params.append('page', filters.page);
  params.append('limit', filters.limit);

  try {
    const data = await makeApiRequest(`/students?${params.toString()}`, { method: 'GET' });
    
    // Instantiate models using the Student OOP Class
    AppState.students = data.students.map(item => new Student(
      item.id,
      item.name,
      item.usn,
      item.course,
      item.semester,
      item.section,
      item.marks,
      item.total_classes,
      item.attended_classes,
      item.created_at
    ));

    renderStudentsTable(data.pagination);
  } catch (err) {
    console.error('Failed to load students:', err);
  }
}

function renderStudentsTable(pagination) {
  const tbody = document.getElementById('studentTableBody');
  tbody.innerHTML = '';

  if (AppState.students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">
          No students match the selected filter query criteria.
        </td>
      </tr>
    `;
    document.getElementById('studentPagination').classList.add('hidden');
    return;
  }

  document.getElementById('studentPagination').classList.remove('hidden');

  AppState.students.forEach(student => {
    const tr = document.createElement('tr');
    
    // Check if user is logged in as admin to show edit/delete controls
    const isAdmin = AppState.user && AppState.user.role === 'admin';
    const actionHtml = isAdmin 
      ? `
        <div class="action-cell">
          <button class="btn-action btn-edit" onclick="handleEditStudent(${student.id})" title="Edit student details">
            <i data-lucide="edit-3"></i>
          </button>
          <button class="btn-action btn-delete" onclick="handleDeleteStudent(${student.id})" title="Remove student record">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `
      : `<span style="font-size:0.75rem; color:var(--text-muted)">Viewer Mode</span>`;

    tr.innerHTML = `
      <td>${student.usn}</td>
      <td style="font-weight: 500">${student.name}</td>
      <td>${student.course}</td>
      <td class="sem-sec-cell">${student.getSemSec()}</td>
      <td class="table-marks">${student.getFormattedMarks()}</td>
      <td class="sem-sec-cell" style="font-family: var(--font-mono); font-size: 0.85rem;">${student.getFormattedAttendance()}</td>
      <td>${actionHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  // Update Pagination Controls
  document.getElementById('studentPageInfo').textContent = `Page ${pagination.page} of ${pagination.pages}`;
  document.getElementById('studentPrevPage').disabled = pagination.page <= 1;
  document.getElementById('studentNextPage').disabled = pagination.page >= pagination.pages;

  lucide.createIcons();
}

// Student form & modal handlers
function openStudentModal(student = null) {
  const modal = document.getElementById('studentModal');
  const title = document.getElementById('studentModalTitle');
  const form = document.getElementById('studentForm');

  // Reset form fields
  form.reset();
  document.getElementById('studentFormId').value = '';

  if (student) {
    title.textContent = 'Edit Student Academic Record';
    document.getElementById('studentFormId').value = student.id;
    document.getElementById('studentFormName').value = student.name;
    document.getElementById('studentFormUsn').value = student.usn;
    document.getElementById('studentFormCourse').value = student.course;
    document.getElementById('studentFormSemester').value = student.semester;
    document.getElementById('studentFormSection').value = student.section;
    document.getElementById('studentFormMarks').value = student.marks;
  } else {
    title.textContent = 'Register New Student Profile';
  }

  modal.classList.remove('hidden');
}

function closeStudentModal() {
  document.getElementById('studentModal').classList.add('hidden');
}

window.handleEditStudent = function(studentId) {
  const student = AppState.students.find(s => s.id === studentId);
  if (student) {
    openStudentModal(student);
  }
};

window.handleDeleteStudent = function(studentId) {
  AppState.deleteContext = { type: 'student', id: studentId };
  const student = AppState.students.find(s => s.id === studentId);
  
  document.getElementById('deleteMessage').innerHTML = `
    Are you sure you want to delete the student profile for <strong>${student.name}</strong> (${student.usn})?<br>
    This will purge their academic records permanently.
  `;
  document.getElementById('deleteModal').classList.remove('hidden');
};

// --------------------------------------------------------------------------
// 8. FACULTY DIRECTORY LOGIC
// --------------------------------------------------------------------------
async function fetchFacultyList() {
  const filters = AppState.facultyFilters;
  
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.department) params.append('department', filters.department);
  params.append('page', filters.page);
  params.append('limit', filters.limit);

  try {
    const data = await makeApiRequest(`/faculty?${params.toString()}`, { method: 'GET' });
    
    // Instantiate models using the Faculty OOP Class
    AppState.faculty = data.faculty.map(item => new Faculty(
      item.id,
      item.name,
      item.employee_id,
      item.department,
      item.subject,
      item.salary,
      item.created_at
    ));

    renderFacultyTable(data.pagination);
  } catch (err) {
    console.error('Failed to load faculty:', err);
  }
}

function renderFacultyTable(pagination) {
  const tbody = document.getElementById('facultyTableBody');
  tbody.innerHTML = '';

  if (AppState.faculty.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">
          No faculty profiles match the selected filter criteria.
        </td>
      </tr>
    `;
    document.getElementById('facultyPagination').classList.add('hidden');
    return;
  }

  document.getElementById('facultyPagination').classList.remove('hidden');

  AppState.faculty.forEach(member => {
    const tr = document.createElement('tr');
    
    const isAdmin = AppState.user && AppState.user.role === 'admin';
    const actionHtml = isAdmin 
      ? `
        <div class="action-cell">
          <button class="btn-action btn-edit" onclick="handleEditFaculty(${member.id})" title="Edit faculty member profile">
            <i data-lucide="edit-3"></i>
          </button>
          <button class="btn-action btn-delete" onclick="handleDeleteFaculty(${member.id})" title="Remove faculty profile">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `
      : `<span style="font-size:0.75rem; color:var(--text-muted)">Viewer Mode</span>`;

    tr.innerHTML = `
      <td>${member.employeeId}</td>
      <td style="font-weight: 500">${member.name}</td>
      <td>${member.department}</td>
      <td>${member.subject}</td>
      <td class="table-salary">${member.getFormattedSalary()}</td>
      <td>${actionHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  // Update Pagination Controls
  document.getElementById('facultyPageInfo').textContent = `Page ${pagination.page} of ${pagination.pages}`;
  document.getElementById('facultyPrevPage').disabled = pagination.page <= 1;
  document.getElementById('facultyNextPage').disabled = pagination.page >= pagination.pages;

  lucide.createIcons();
}

// Faculty form & modal handlers
function openFacultyModal(member = null) {
  const modal = document.getElementById('facultyModal');
  const title = document.getElementById('facultyModalTitle');
  const form = document.getElementById('facultyForm');

  // Reset form fields
  form.reset();
  document.getElementById('facultyFormId').value = '';

  if (member) {
    title.textContent = 'Edit Faculty Employment Details';
    document.getElementById('facultyFormId').value = member.id;
    document.getElementById('facultyFormName').value = member.name;
    document.getElementById('facultyFormEmpId').value = member.employeeId;
    document.getElementById('facultyFormDept').value = member.department;
    document.getElementById('facultyFormSubject').value = member.subject;
    document.getElementById('facultyFormSalary').value = member.salary;
  } else {
    title.textContent = 'Register New Faculty Employee';
  }

  modal.classList.remove('hidden');
}

function closeFacultyModal() {
  document.getElementById('facultyModal').classList.add('hidden');
}

window.handleEditFaculty = function(facultyId) {
  const member = AppState.faculty.find(f => f.id === facultyId);
  if (member) {
    openFacultyModal(member);
  }
};

window.handleDeleteFaculty = function(facultyId) {
  AppState.deleteContext = { type: 'faculty', id: facultyId };
  const member = AppState.faculty.find(f => f.id === facultyId);

  document.getElementById('deleteMessage').innerHTML = `
    Are you sure you want to delete the faculty profile for <strong>${member.name}</strong> (${member.employeeId})?<br>
    This will delete all employment records permanently.
  `;
  document.getElementById('deleteModal').classList.remove('hidden');
};

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.add('hidden');
  AppState.deleteContext = { type: null, id: null };
}

// --------------------------------------------------------------------------
// 9. AUTH FLOW CONTROLLERS
// --------------------------------------------------------------------------
async function handleLoginFormSubmit(e) {
  e.preventDefault();
  
  const usernameInput = document.getElementById('loginUsername').value.trim();
  const passwordInput = document.getElementById('loginPassword').value.trim();

  try {
    const data = await makeApiRequest('/auth/login', {
      method: 'POST',
      body: { username: usernameInput, password: passwordInput }
    });

    // Save token and user details
    AppState.token = data.token;
    AppState.user = data.user;
    localStorage.setItem('cms_jwt_token', data.token);
    localStorage.setItem('cms_user_data', JSON.stringify(data.user));

    showToast(data.message || 'Authenticated successfully.', 'success');

    // Launch App View Workspace
    bootstrapApplication();

  } catch (err) {
    console.error('Authentication failure:', err);
  }
}

function handleLogoutAction() {
  // Clear states
  AppState.token = null;
  AppState.user = null;
  localStorage.removeItem('cms_jwt_token');
  localStorage.removeItem('cms_user_data');

  // Toggle Screen Views
  document.getElementById('appLayout').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');

  // Clean form credentials
  document.getElementById('loginPassword').value = '';
}

function bootstrapApplication() {
  // Hide Login View, Show app Layout workspace
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appLayout').classList.remove('hidden');

  // Set User Profile headers
  if (AppState.user) {
    document.getElementById('sessionUser').textContent = AppState.user.username;
    document.getElementById('sessionRole').textContent = `${AppState.user.role} role`;
    
    // Toggle Admin Badge
    const badge = document.getElementById('authBadge');
    if (AppState.user.role === 'admin') {
      badge.innerHTML = `<span class="badge-dot"></span> Admin Access`;
      badge.style.borderColor = 'rgba(227, 179, 65, 0.25)';
      badge.style.background = 'rgba(227, 179, 65, 0.08)';
      badge.style.color = 'var(--gold)';
      
      // Show add button controls
      document.getElementById('addStudentBtn').classList.remove('hidden');
      document.getElementById('addFacultyBtn').classList.remove('hidden');
    } else {
      badge.innerHTML = `<span class="badge-dot" style="background:var(--text-muted)"></span> Guest Viewer`;
      badge.style.borderColor = 'rgba(240, 246, 252, 0.1)';
      badge.style.background = 'rgba(255,255,255,0.03)';
      badge.style.color = 'var(--text-muted)';
      
      // Hide add button controls
      document.getElementById('addStudentBtn').classList.add('hidden');
      document.getElementById('addFacultyBtn').classList.add('hidden');
    }
  }

  // Load router views
  initRouter();
}

// --------------------------------------------------------------------------
// 10. CRUD POST / PUT / DELETE LOGIC IMPLEMENTATIONS
// --------------------------------------------------------------------------

// Submit Student form
async function handleStudentFormSubmit(e) {
  e.preventDefault();
  
  const studentId = document.getElementById('studentFormId').value;
  const payload = {
    name: document.getElementById('studentFormName').value.trim(),
    usn: document.getElementById('studentFormUsn').value.trim(),
    course: document.getElementById('studentFormCourse').value,
    semester: parseInt(document.getElementById('studentFormSemester').value),
    section: document.getElementById('studentFormSection').value.trim(),
    marks: parseFloat(document.getElementById('studentFormMarks').value)
  };

  const isEdit = studentId !== '';
  const url = isEdit ? `/students/${studentId}` : '/students';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const response = await makeApiRequest(url, {
      method: method,
      body: payload
    });

    showToast(response.message || 'Record successfully synchronized.', 'success');
    closeStudentModal();
    fetchStudentsList();
  } catch (err) {
    console.error('Failed to submit student form:', err);
  }
}

// Submit Faculty form
async function handleFacultyFormSubmit(e) {
  e.preventDefault();

  const facultyId = document.getElementById('facultyFormId').value;
  const payload = {
    name: document.getElementById('facultyFormName').value.trim(),
    employee_id: document.getElementById('facultyFormEmpId').value.trim(),
    department: document.getElementById('facultyFormDept').value,
    subject: document.getElementById('facultyFormSubject').value.trim(),
    salary: parseFloat(document.getElementById('facultyFormSalary').value)
  };

  const isEdit = facultyId !== '';
  const url = isEdit ? `/faculty/${facultyId}` : '/faculty';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const response = await makeApiRequest(url, {
      method: method,
      body: payload
    });

    showToast(response.message || 'Employment record synchronized.', 'success');
    closeFacultyModal();
    fetchFacultyList();
  } catch (err) {
    console.error('Failed to submit faculty form:', err);
  }
}

// Execute deletion confirmation
async function handleConfirmDelete() {
  const { type, id } = AppState.deleteContext;
  if (!type || !id) return;

  const endpoint = type === 'student' ? `/students/${id}` : `/faculty/${id}`;

  try {
    const data = await makeApiRequest(endpoint, { method: 'DELETE' });
    showToast(data.message || 'Record deleted successfully.', 'success');
    closeDeleteModal();
    
    // Refresh correct list
    if (type === 'student') {
      fetchStudentsList();
    } else {
      fetchFacultyList();
    }
  } catch (err) {
    console.error('Failed to execute record deletion:', err);
  }
}

// --------------------------------------------------------------------------
// 11. GLOBAL EVENTS & CLOCK ATTACHMENTS
// --------------------------------------------------------------------------
function startHeaderClock() {
  const clockEl = document.getElementById('headerClock');
  
  function updateTime() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  updateTime();
  setInterval(updateTime, 1000);
}

function registerEventListeners() {
  // Auth Form
  document.getElementById('loginForm').addEventListener('submit', handleLoginFormSubmit);
  
  // Logout Btn
  document.getElementById('logoutBtn').addEventListener('click', handleLogoutAction);

  // Student Filter Inputs
  const studSearch = document.getElementById('studentSearch');
  const studCourse = document.getElementById('studentCourseFilter');
  const studSem = document.getElementById('studentSemesterFilter');
  const studSec = document.getElementById('studentSectionFilter');
  
  const triggerStudentSearch = () => {
    AppState.studentFilters.search = studSearch.value.trim();
    AppState.studentFilters.course = studCourse.value;
    AppState.studentFilters.semester = studSem.value;
    AppState.studentFilters.section = studSec.value;
    AppState.studentFilters.page = 1; // reset page
    fetchStudentsList();
  };

  // Debounced input search
  let studTimeout = null;
  studSearch.addEventListener('input', () => {
    clearTimeout(studTimeout);
    studTimeout = setTimeout(triggerStudentSearch, 400);
  });
  studCourse.addEventListener('change', triggerStudentSearch);
  studSem.addEventListener('change', triggerStudentSearch);
  studSec.addEventListener('change', triggerStudentSearch);

  document.getElementById('studentResetFilters').addEventListener('click', () => {
    studSearch.value = '';
    studCourse.value = '';
    studSem.value = '';
    studSec.value = '';
    AppState.studentFilters = { search: '', course: '', semester: '', section: '', page: 1, limit: 10 };
    fetchStudentsList();
  });

  // Student Paginations
  document.getElementById('studentPrevPage').addEventListener('click', () => {
    if (AppState.studentFilters.page > 1) {
      AppState.studentFilters.page--;
      fetchStudentsList();
    }
  });
  document.getElementById('studentNextPage').addEventListener('click', () => {
    AppState.studentFilters.page++;
    fetchStudentsList();
  });

  // Student Modals
  document.getElementById('addStudentBtn').addEventListener('click', () => openStudentModal());
  document.getElementById('studentModalCloseBtn').addEventListener('click', closeStudentModal);
  document.getElementById('studentCancelBtn').addEventListener('click', closeStudentModal);
  document.getElementById('studentForm').addEventListener('submit', handleStudentFormSubmit);

  // Faculty Filter Inputs
  const facSearch = document.getElementById('facultySearch');
  const facDept = document.getElementById('facultyDeptFilter');

  const triggerFacultySearch = () => {
    AppState.facultyFilters.search = facSearch.value.trim();
    AppState.facultyFilters.department = facDept.value;
    AppState.facultyFilters.page = 1;
    fetchFacultyList();
  };

  let facTimeout = null;
  facSearch.addEventListener('input', () => {
    clearTimeout(facTimeout);
    facTimeout = setTimeout(triggerFacultySearch, 400);
  });
  facDept.addEventListener('change', triggerFacultySearch);

  document.getElementById('facultyResetFilters').addEventListener('click', () => {
    facSearch.value = '';
    facDept.value = '';
    AppState.facultyFilters = { search: '', department: '', page: 1, limit: 10 };
    fetchFacultyList();
  });

  // Faculty Paginations
  document.getElementById('facultyPrevPage').addEventListener('click', () => {
    if (AppState.facultyFilters.page > 1) {
      AppState.facultyFilters.page--;
      fetchFacultyList();
    }
  });
  document.getElementById('facultyNextPage').addEventListener('click', () => {
    AppState.facultyFilters.page++;
    fetchFacultyList();
  });

  // Faculty Modals
  document.getElementById('addFacultyBtn').addEventListener('click', () => openFacultyModal());
  document.getElementById('facultyModalCloseBtn').addEventListener('click', closeFacultyModal);
  document.getElementById('facultyCancelBtn').addEventListener('click', closeFacultyModal);
  document.getElementById('facultyForm').addEventListener('submit', handleFacultyFormSubmit);

  // Delete Confirm Modal
  document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteConfirmBtn').addEventListener('click', handleConfirmDelete);

  // Attendance Events
  document.getElementById('loadAttendanceBtn').addEventListener('click', fetchAttendanceSheet);
  document.getElementById('attendanceForm').addEventListener('submit', handleAttendanceFormSubmit);
}

// --------------------------------------------------------------------------
// 11.5. ATTENDANCE SHEET OPERATIONS
// --------------------------------------------------------------------------
function initAttendanceView() {
  const datePicker = document.getElementById('attendanceDate');
  // Set default date to today's date if not set (format: YYYY-MM-DD)
  if (!datePicker.value) {
    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;
  }

  // Clear table sheet on entrance
  const tbody = document.getElementById('attendanceTableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="3" class="table-empty">
        Select class criteria and load sheet to register attendance.
      </td>
    </tr>
  `;
  document.getElementById('attendanceActionsBar').classList.add('hidden');
}

async function fetchAttendanceSheet() {
  const date = document.getElementById('attendanceDate').value;
  const course = document.getElementById('attendanceCourseFilter').value;
  const semester = parseInt(document.getElementById('attendanceSemesterFilter').value);
  const section = document.getElementById('attendanceSectionFilter').value;

  if (!date) {
    showToast('Please select a valid date.', 'warning');
    return;
  }

  const params = new URLSearchParams({ date, course, semester, section });

  try {
    const data = await makeApiRequest(`/attendance?${params.toString()}`, { method: 'GET' });
    AppState.attendanceSheet = data;

    renderAttendanceSheet();
  } catch (err) {
    console.error('Failed to load attendance sheet:', err);
  }
}

function renderAttendanceSheet() {
  const tbody = document.getElementById('attendanceTableBody');
  const actionsBar = document.getElementById('attendanceActionsBar');
  tbody.innerHTML = '';

  if (AppState.attendanceSheet.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="table-empty">
          No students are currently registered in this class.
        </td>
      </tr>
    `;
    actionsBar.classList.add('hidden');
    return;
  }

  // Show actions bar if admin is logged in
  const isAdmin = AppState.user && AppState.user.role === 'admin';
  if (isAdmin) {
    actionsBar.classList.remove('hidden');
  } else {
    actionsBar.classList.add('hidden');
  }

  AppState.attendanceSheet.forEach(student => {
    const tr = document.createElement('tr');
    
    // Status resolution (defaults to Present if not logged)
    const status = student.status || 'Present';
    
    // Disable radio inputs if viewer role
    const disabledAttr = isAdmin ? '' : 'disabled';

    tr.innerHTML = `
      <td>${student.usn}</td>
      <td style="font-weight: 500">${student.name}</td>
      <td>
        <div class="status-radio-group">
          <label class="status-radio-label present-label">
            <input type="radio" name="status-${student.id}" value="Present" ${status === 'Present' ? 'checked' : ''} ${disabledAttr}> Present
          </label>
          <label class="status-radio-label absent-label">
            <input type="radio" name="status-${student.id}" value="Absent" ${status === 'Absent' ? 'checked' : ''} ${disabledAttr}> Absent
          </label>
          <label class="status-radio-label late-label">
            <input type="radio" name="status-${student.id}" value="Late" ${status === 'Late' ? 'checked' : ''} ${disabledAttr}> Late
          </label>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleAttendanceFormSubmit(e) {
  e.preventDefault();

  const date = document.getElementById('attendanceDate').value;
  const records = [];

  // Iterate students and retrieve radio states
  AppState.attendanceSheet.forEach(student => {
    const radioGroup = document.getElementsByName(`status-${student.id}`);
    let selectedStatus = 'Present';
    for (const radio of radioGroup) {
      if (radio.checked) {
        selectedStatus = radio.value;
        break;
      }
    }
    records.push({
      student_id: student.id,
      status: selectedStatus
    });
  });

  try {
    const response = await makeApiRequest('/attendance/batch', {
      method: 'POST',
      body: { date, records }
    });

    showToast(response.message || 'Attendance updated successfully.', 'success');
    
    // Reload sheet to fetch updated values
    fetchAttendanceSheet();
  } catch (err) {
    console.error('Failed to submit batch attendance:', err);
  }
}

// --------------------------------------------------------------------------
// 12. INITIALIZATION ON PAGE LOAD
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Initialize general UI
  startHeaderClock();
  registerEventListeners();
  lucide.createIcons();

  // Restore/Restore user session
  if (AppState.token) {
    bootstrapApplication();
  } else {
    // Show login interface
    document.getElementById('loginView').classList.remove('hidden');
  }
});
