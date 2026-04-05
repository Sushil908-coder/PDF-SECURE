/**
 * Admin Dashboard — Full JavaScript Logic
 */

// ─── Auth Guard ──────────────────────────────────────────────────────────────
(function() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (!token || role !== 'admin') {
    window.location.href = '/';
  }
})();

// ─── State ────────────────────────────────────────────────────────────────────
let allUsers = [];
let currentFilter = 'all';
let selectedFile = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Show admin name
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  document.getElementById('adminInfo').textContent = `Logged in as: ${user.name || 'Admin'}`;

  loadStats();
  setupFileDrop();

  // Auto-refresh stats every 30 seconds
  setInterval(loadStats, 30000);
});

// ─── Tab Navigation ───────────────────────────────────────────────────────────
function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  document.getElementById(`tab-${tabName}`).classList.add('active');
  event.currentTarget.classList.add('active');

  const titles = { dashboard: 'Dashboard', pdfs: 'PDF Files', users: 'Students' };
  document.getElementById('pageTitle').textContent = titles[tabName] || tabName;

  // Load data when tab opens
  if (tabName === 'pdfs') loadPDFs();
  if (tabName === 'users') loadUsers();
  if (tabName === 'dashboard') loadStats();

  closeSidebar();
}

// ─── Sidebar (mobile) ─────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

// ─── Dashboard: Load Stats ────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await API.get('/api/admin/stats');
    if (!res) return;
    const data = await res.json();
    if (!data.success) return;

    const { stats, recentActivity } = data;
    document.getElementById('statTotal').textContent = stats.totalStudents;
    document.getElementById('statApproved').textContent = stats.approvedStudents;
    document.getElementById('statPending').textContent = stats.pendingStudents;
    document.getElementById('statBlocked').textContent = stats.blockedStudents;
    document.getElementById('statOnline').textContent = stats.activeNow;
    document.getElementById('statPDFs').textContent = stats.totalPDFs;
    document.getElementById('onlineBadge').textContent = `● ${stats.activeNow} online`;

    // Render activity
    const container = document.getElementById('activityList');
    if (!recentActivity || recentActivity.length === 0) {
      container.innerHTML = '<div class="empty-state">No recent activity.</div>';
      return;
    }

    container.innerHTML = recentActivity.map(log => `
      <div class="activity-item">
        <div class="activity-icon">📖</div>
        <div class="activity-body">
          <div class="activity-title">${esc(log.user?.name || 'Unknown')} viewed a PDF</div>
          <div class="activity-meta">${esc(log.pdf?.title || 'Unknown PDF')}</div>
        </div>
        <div class="activity-time">${timeAgo(log.createdAt)}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadStats error:', err);
  }
}

// ─── PDFs: Load List ──────────────────────────────────────────────────────────
async function loadPDFs() {
  const container = document.getElementById('pdfList');
  container.innerHTML = '<div class="empty-state">Loading PDFs...</div>';

  try {
    const res = await API.get('/api/pdf/list');
    if (!res) return;
    const data = await res.json();
    if (!data.success) { container.innerHTML = '<div class="empty-state">Failed to load PDFs.</div>'; return; }

    if (data.pdfs.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div>No PDFs uploaded yet.</div>';
      return;
    }

    container.innerHTML = data.pdfs.map(pdf => `
      <div class="pdf-card ${pdf.isActive ? '' : 'inactive'}" id="pdf-${pdf._id}">
        <div class="pdf-card-header">
          <div class="pdf-title">${esc(pdf.title)}</div>
          <span class="pdf-badge ${pdf.isActive ? 'badge-active' : 'badge-hidden'}">
            ${pdf.isActive ? '● Visible' : '○ Hidden'}
          </span>
        </div>
        <div class="pdf-meta">
          <span>📁 ${esc(pdf.category || 'General')}</span>
          <span>📏 ${formatBytes(pdf.fileSize)}</span>
          <span>👁️ ${pdf.viewCount || 0} views</span>
          <span>📅 ${formatDate(pdf.createdAt)}</span>
          ${pdf.description ? `<span>💬 ${esc(pdf.description)}</span>` : ''}
        </div>
        <div class="pdf-actions">
          <button class="btn-sm btn-warning" onclick="togglePDF('${pdf._id}', this)">
            ${pdf.isActive ? '🙈 Hide' : '👁️ Show'}
          </button>
          <button class="btn-sm btn-danger" onclick="deletePDF('${pdf._id}', '${esc(pdf.title)}')">
            🗑️ Delete
          </button>
          <button class="btn-sm btn-info" onclick="previewPDF('${pdf._id}')">
            👁️ Preview
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="empty-state">Error loading PDFs.</div>';
  }
}

// ─── PDFs: File Drop Setup ────────────────────────────────────────────────────
function setupFileDrop() {
  const drop = document.getElementById('fileDrop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });
}

function handleFileSelect(input) {
  if (input.files[0]) processFile(input.files[0]);
}

function processFile(file) {
  if (file.type !== 'application/pdf') {
    showToast('Only PDF files are allowed.', 'error');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast('File exceeds 50MB limit.', 'error');
    return;
  }
  selectedFile = file;
  document.getElementById('fileHint').textContent = `✅ ${file.name} (${formatBytes(file.size)})`;
  document.getElementById('fileDrop').style.borderColor = 'var(--success)';
}

// ─── PDFs: Upload ─────────────────────────────────────────────────────────────
async function uploadPDF() {
  const title = document.getElementById('pdfTitle').value.trim();
  const description = document.getElementById('pdfDesc').value.trim();
  const category = document.getElementById('pdfCategory').value.trim();

  if (!title) { showToast('Please enter a PDF title.', 'error'); return; }
  if (!selectedFile) { showToast('Please select a PDF file.', 'error'); return; }

  const formData = new FormData();
  formData.append('pdf', selectedFile);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('category', category || 'General');

  const btn = document.getElementById('uploadBtn');
  const progressEl = document.getElementById('uploadProgress');
  const fillEl = document.getElementById('progressFill');
  const textEl = document.getElementById('progressText');

  btn.disabled = true;
  btn.textContent = 'Uploading...';
  progressEl.style.display = 'flex';

  // Simulate progress (XHR for real progress)
  try {
    let progress = 0;
    const interval = setInterval(() => {
      progress = Math.min(progress + 10, 85);
      fillEl.style.width = progress + '%';
      textEl.textContent = `Uploading... ${progress}%`;
    }, 200);

    const res = await API.upload('/api/pdf/upload', formData);
    clearInterval(interval);
    fillEl.style.width = '100%';
    textEl.textContent = 'Processing...';

    const data = await res.json();
    if (data.success) {
      showToast('PDF uploaded successfully!', 'success');
      // Reset form
      document.getElementById('pdfTitle').value = '';
      document.getElementById('pdfDesc').value = '';
      document.getElementById('pdfCategory').value = '';
      document.getElementById('fileHint').textContent = 'Max 50MB · PDF only';
      document.getElementById('fileDrop').style.borderColor = '';
      document.getElementById('pdfFile').value = '';
      selectedFile = null;
      setTimeout(() => { progressEl.style.display = 'none'; fillEl.style.width = '0%'; }, 1000);
      loadPDFs();
    } else {
      showToast(data.message || 'Upload failed.', 'error');
      progressEl.style.display = 'none';
    }
  } catch (err) {
    showToast('Upload error. Please try again.', 'error');
    progressEl.style.display = 'none';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload PDF';
  }
}

// ─── PDFs: Delete ─────────────────────────────────────────────────────────────
async function deletePDF(id, title) {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
  try {
    const res = await API.delete(`/api/pdf/${id}`);
    if (!res) return;
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById(`pdf-${id}`)?.remove();
    } else {
      showToast(data.message || 'Delete failed.', 'error');
    }
  } catch { showToast('Error deleting PDF.', 'error'); }
}

// ─── PDFs: Toggle Visibility ──────────────────────────────────────────────────
async function togglePDF(id, btn) {
  try {
    const res = await API.patch(`/api/pdf/${id}/toggle`);
    if (!res) return;
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'info');
      loadPDFs();
    } else {
      showToast(data.message || 'Failed.', 'error');
    }
  } catch { showToast('Error updating PDF.', 'error'); }
}

// ─── PDFs: Preview (admin can view) ──────────────────────────────────────────
function previewPDF(id) {
  const token = localStorage.getItem('token');
  const deviceId = localStorage.getItem('deviceId');
  window.open(`/student/viewer.html?id=${id}&admin=1`, '_blank');
}

// ─── Users: Load ─────────────────────────────────────────────────────────────
async function loadUsers() {
  const container = document.getElementById('userList');
  container.innerHTML = '<div class="empty-state">Loading students...</div>';

  try {
    const res = await API.get('/api/admin/users');
    if (!res) return;
    const data = await res.json();
    if (!data.success) { container.innerHTML = '<div class="empty-state">Failed to load students.</div>'; return; }

    allUsers = data.users;
    renderUsers(currentFilter);
  } catch { container.innerHTML = '<div class="empty-state">Error loading students.</div>'; }
}

function filterUsers(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderUsers(filter);
}

function renderUsers(filter) {
  const container = document.getElementById('userList');
  let users = allUsers;

  if (filter === 'pending') users = users.filter(u => !u.isApproved && !u.isBlocked);
  else if (filter === 'approved') users = users.filter(u => u.isApproved && !u.isBlocked);
  else if (filter === 'blocked') users = users.filter(u => u.isBlocked);

  if (users.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div>No students found.</div>`;
    return;
  }

  container.innerHTML = users.map(user => {
    const isOnline = user.isOnline;
    const statusLabel = user.isBlocked ? 'Blocked'
      : isOnline ? 'Online'
      : user.isApproved ? 'Approved'
      : 'Pending';
    const statusClass = user.isBlocked ? 'status-blocked'
      : isOnline ? 'status-online'
      : user.isApproved ? 'status-approved'
      : 'status-pending';

    return `
      <div class="user-card" id="user-${user._id}">
        <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name">
            ${esc(user.name)}
            <span class="user-status ${statusClass}">${statusLabel}</span>
          </div>
          <div class="user-meta">
            ID: ${esc(user.userId)}
            ${user.batch ? ` · ${esc(user.batch)}` : ''}
            ${user.lastLogin ? ` · Last login: ${timeAgo(user.lastLogin)}` : ''}
          </div>
          ${user.deviceInfo ? `<div class="device-info">📱 ${esc(user.deviceInfo)}</div>` : ''}
        </div>
        <div class="user-actions">
          ${!user.isApproved && !user.isBlocked ? `
            <button class="btn-sm btn-success" onclick="approveUser('${user._id}')">✅ Approve</button>
          ` : ''}
          <button class="btn-sm ${user.isBlocked ? 'btn-success' : 'btn-warning'}" 
                  onclick="toggleBlock('${user._id}')">
            ${user.isBlocked ? '🔓 Unblock' : '🚫 Block'}
          </button>
          ${user.deviceId ? `
            <button class="btn-sm btn-info" onclick="resetDevice('${user._id}')">📱 Reset Device</button>
          ` : ''}
          <button class="btn-sm btn-danger" onclick="deleteUser('${user._id}', '${esc(user.name)}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Users: Create ────────────────────────────────────────────────────────────
async function createStudent() {
  const userId = document.getElementById('newUserId').value.trim();
  const name = document.getElementById('newName').value.trim();
  const password = document.getElementById('newPassword').value;
  const batch = document.getElementById('newBatch').value.trim();

  if (!userId || !name || !password) {
    showToast('User ID, name, and password are required.', 'error'); return;
  }
  if (password.length < 6) {
    showToast('Password must be at least 6 characters.', 'error'); return;
  }

  try {
    const res = await API.post('/api/admin/users', { userId, name, password, batch });
    if (!res) return;
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('newUserId').value = '';
      document.getElementById('newName').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('newBatch').value = '';
      loadUsers();
    } else {
      showToast(data.message || 'Failed to create student.', 'error');
    }
  } catch { showToast('Error creating student.', 'error'); }
}

// ─── Users: Approve ───────────────────────────────────────────────────────────
async function approveUser(id) {
  try {
    const res = await API.patch(`/api/admin/users/${id}/approve`);
    if (!res) return;
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); loadUsers(); }
    else showToast(data.message || 'Failed.', 'error');
  } catch { showToast('Error approving user.', 'error'); }
}

// ─── Users: Block/Unblock ────────────────────────────────────────────────────
async function toggleBlock(id) {
  try {
    const res = await API.patch(`/api/admin/users/${id}/block`);
    if (!res) return;
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); loadUsers(); }
    else showToast(data.message || 'Failed.', 'error');
  } catch { showToast('Error updating user.', 'error'); }
}

// ─── Users: Delete ────────────────────────────────────────────────────────────
async function deleteUser(id, name) {
  if (!confirm(`Permanently delete ${name}'s account? This cannot be undone.`)) return;
  try {
    const res = await API.delete(`/api/admin/users/${id}`);
    if (!res) return;
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); loadUsers(); }
    else showToast(data.message || 'Failed.', 'error');
  } catch { showToast('Error deleting user.', 'error'); }
}

// ─── Users: Reset Device ──────────────────────────────────────────────────────
async function resetDevice(id) {
  if (!confirm('Reset this student\'s device? They will be able to login from a new device.')) return;
  try {
    const res = await API.patch(`/api/admin/users/${id}/reset-device`);
    if (!res) return;
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); loadUsers(); }
    else showToast(data.message || 'Failed.', 'error');
  } catch { showToast('Error resetting device.', 'error'); }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1048576).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}
