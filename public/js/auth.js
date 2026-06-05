// public/js/auth.js
// ─────────────────────────────────────────────────────────────
// Handles the login and register forms.
//
// WHAT IS fetch()?
// fetch() is the browser's built-in tool for making HTTP requests
// from JavaScript. Instead of the page reloading (old HTML form
// behaviour), fetch() sends the request in the background and
// lets us handle the response without leaving the page.
// This is what makes modern web apps feel instant.
//
// ASYNC / AWAIT:
// Database queries and network requests take time.
// async/await lets us write code that waits for them to finish
// before continuing, without blocking the entire browser.
// Any function marked async can use await inside it.
// await pauses that function until the Promise resolves.
// ─────────────────────────────────────────────────────────────

// Switch between Login and Register tabs
function showTab(tab) {
  document.getElementById('form-login')
    .classList.toggle('active', tab === 'login');
  document.getElementById('form-register')
    .classList.toggle('active', tab === 'register');
  document.getElementById('tab-login')
    .classList.toggle('active', tab === 'login');
  document.getElementById('tab-register')
    .classList.toggle('active', tab === 'register');

  // Clear errors when switching tabs
  document.getElementById('login-error').textContent = '';
  document.getElementById('reg-error').textContent   = '';
}

// ── LOGIN ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault(); // stop the form from doing a page reload

  const btn     = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  // Disable button while request is in flight — prevents double submit
  btn.disabled    = true;
  btn.textContent = 'Logging in...';

  try {
    const response = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Login successful — go to the main app
      window.location.href = '/app.html';
    } else {
      errorEl.textContent = data.error;
    }

  } catch (err) {
    errorEl.textContent = 'Could not connect to server. Is it running?';
  } finally {
    // Always re-enable the button
    btn.disabled    = false;
    btn.textContent = 'Login';
  }
}

// ── REGISTER ──────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();

  const btn     = document.getElementById('reg-btn');
  const errorEl = document.getElementById('reg-error');
  errorEl.textContent = '';

  const data = {
    full_name:    document.getElementById('reg-name').value.trim(),
    username:     document.getElementById('reg-username').value.trim(),
    email:        document.getElementById('reg-email').value.trim(),
    password:     document.getElementById('reg-password').value,
    university:   document.getElementById('reg-university').value.trim(),
    course:       document.getElementById('reg-course').value.trim(),
    year_of_study: parseInt(document.getElementById('reg-year').value),
  };

  if (data.password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Creating account...';

  try {
    const response = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok) {
      window.location.href = '/app.html';
    } else {
      errorEl.textContent = result.error;
    }

  } catch (err) {
    errorEl.textContent = 'Could not connect to server. Is it running?';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Create Account';
  }
}

// ── SESSION CHECK ON PAGE LOAD ────────────────────────────────
// If the user is already logged in (valid session from before),
// skip the login page entirely and go straight to the app.
(async function checkExistingSession() {
  try {
    const response = await fetch('/api/auth/me');
    const data     = await response.json();
    if (data.loggedIn) {
      window.location.href = '/app.html';
    }
  } catch (err) {
    // Server not reachable — stay on login page
  }
})();