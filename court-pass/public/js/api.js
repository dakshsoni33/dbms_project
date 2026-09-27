// api.js
// Shared helpers loaded by every page: a fetch wrapper, the login-session
// helpers that decide student vs admin, and a couple of formatters.

const SESSION_KEY = 'courtpass_user';

// ---------- Session ----------

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function logout() {
  clearSession();
  window.location.href = '/index.html';
}

// Call this at the top of every page except the login page.
// requiredRole is 'student' or 'admin' — a student who lands on an admin
// page (or vice versa) gets bounced to their own home screen.
function requireSession(requiredRole) {
  const user = getSession();
  if (!user) {
    window.location.href = '/index.html';
    return null;
  }
  if (requiredRole && user.role !== requiredRole) {
    window.location.href = user.role === 'admin' ? '/admin/dashboard.html' : '/student/home.html';
    return null;
  }
  return user;
}

// ---------- API calls ----------

async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong.');
  }
  return data;
}

// ---------- Formatting ----------

// '14:30:00' -> '2:30 PM'
function formatTime(sqlTime) {
  const [h, m] = sqlTime.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// '2026-09-30T00:00:00.000Z' or '2026-09-30' -> '30 Sep'
function formatDate(sqlDate) {
  const d = new Date(sqlDate);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
