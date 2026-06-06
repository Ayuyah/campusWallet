// public/js/api.js
// ─────────────────────────────────────────────────────────────
// A shared fetch wrapper used by every page in the app.
//
// WHY A WRAPPER?
// Every API call needs the same setup: Content-Type header,
// error handling, redirect to login on 401.
// Without a wrapper, every file repeats this boilerplate.
// With api.js, every file just calls: api.get('/expenses')
// or api.post('/expenses', data) — clean and consistent.
//
// This pattern is called DRY: Don't Repeat Yourself.
// It's one of the most important principles in software development.
// ─────────────────────────────────────────────────────────────

const api = {

  async request(method, url, body = null) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch('/api' + url, options);

    // If the server says "not logged in", go to login page
    if (response.status === 401) {
      window.location.href = '/index.html';
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }

    return data;
  },

  get:    (url)        => api.request('GET',    url),
  post:   (url, body)  => api.request('POST',   url, body),
  put:    (url, body)  => api.request('PUT',    url, body),
  delete: (url)        => api.request('DELETE', url),
};

// Show a toast notification (success or error message)
// Used across all pages — defined once here, available everywhere
function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className   = `toast ${type}`;

  // Trigger reflow so the transition plays
  void toast.offsetWidth;
  toast.classList.add('show');

  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Format a number as KES currency
// e.g. 1234.5 → "KES 1,234.50"
function formatKES(amount) {
  return 'KES ' + parseFloat(amount).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Format a date string for display
// e.g. "2024-01-15" → "Jan 15, 2024"
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-KE', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}