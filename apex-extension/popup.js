document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('password').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') login();
});

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const statusEl = document.getElementById('status');
  const loginBtn = document.getElementById('loginBtn');

  if (!email || !password) {
    showStatus('Please fill in all fields', 'error');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  try {
    const response = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      await chrome.storage.local.set({
        access_token: data.access_token,
        user_id: data.user_id,
        email: email
      });

      showStatus('Login successful!', 'success');
      setTimeout(() => {
        showLoginForm(false);
        displayUserInfo(data.user_id, email);
      }, 500);
    } else {
      showStatus(data.detail || 'Login failed', 'error');
    }
  } catch (error) {
    showStatus('Connection error: ' + error.message, 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
}

async function logout() {
  await chrome.storage.local.remove(['access_token', 'user_id', 'email']);
  document.getElementById('email').value = '';
  document.getElementById('password').value = '';
  showLoginForm(true);
  document.getElementById('status').style.display = 'none';
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function showLoginForm(show) {
  document.getElementById('loginSection').style.display = show ? 'block' : 'none';
  document.getElementById('loggedInSection').classList.toggle('show', !show);
}

function displayUserInfo(userId, email) {
  document.getElementById('userId').textContent = userId;
  document.getElementById('userEmail').textContent = email;
}

// Check if already logged in on popup open
chrome.storage.local.get(['access_token', 'user_id', 'email'], (result) => {
  if (result.access_token) {
    showLoginForm(false);
    displayUserInfo(result.user_id, result.email);
  }
});