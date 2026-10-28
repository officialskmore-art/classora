// ============================================
// CLASSORA — Main JavaScript
// ============================================

'use strict';

/* ─── Security: HTML Sanitizer / Escaping Utility ────────── */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHTML = escapeHTML;

/* ─── Toast Notifications ─────────────────── */
function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || '📢'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ─── Form Validation ─────────────────────── */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(pass) {
  return pass.length >= 8;
}

function validatePhoneNumber(phone) {
  if (!phone || !phone.trim()) return true; // Optional by default
  const cleaned = phone.trim().replace(/[\s\-\(\)\+]/g, '');
  // Match 10-digit phone or +91 format (last 10 digits)
  if (/^91[6-9]\d{9}$/.test(cleaned)) return true;
  return /^[6-9]\d{9}$/.test(cleaned) || /^\d{10}$/.test(cleaned);
}

function setError(inputId, msg) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.classList.add('error');
  let err = el.parentElement.querySelector('.form-error');
  if (!err) {
    err = document.createElement('div');
    err.className = 'form-error';
    err.style.cssText = 'font-size:0.8rem;color:#EF4444;margin-top:4px;';
    el.parentElement.appendChild(err);
  }
  err.textContent = msg;
}

function clearError(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.classList.remove('error');
  const err = el.parentElement?.querySelector('.form-error');
  if (err) err.remove();
}

function clearAllErrors(form) {
  form.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));
  form.querySelectorAll('.form-error').forEach(el => el.remove());
}

/* ─── Password Toggle ─────────────────────── */
function initPasswordToggles() {
  document.querySelectorAll('[data-toggle-password]').forEach(btn => {
    const targetId = btn.dataset.togglePassword;
    const input = document.getElementById(targetId);
    if (!input) return;
    btn.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? '🙈' : '👁️';
    });
  });
}

/* ─── Sidebar Toggle (Mobile) ─────────────── */
function initSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  let overlay = document.getElementById('sidebar-overlay');

  if (!sidebar) return;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  function open() {
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (toggle && !toggle.dataset.sidebarBound) {
    toggle.dataset.sidebarBound = 'true';
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.contains('open') ? close() : open();
    });
  }
  if (overlay && !overlay.dataset.sidebarBound) {
    overlay.dataset.sidebarBound = 'true';
    overlay.addEventListener('click', close);
  }

  // Ensure "Log Out" link exists in sidebar across all portal pages (Bug N7)
  const nav = sidebar.querySelector('.sidebar-nav');
  if (nav && !sidebar.querySelector('.sidebar-logout-link')) {
    const logoutSec = document.createElement('span');
    logoutSec.className = 'sidebar-section-label';
    logoutSec.style.marginTop = '16px';
    logoutSec.textContent = 'Account';
    
    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.className = 'sidebar-link sidebar-logout-link';
    logoutLink.style.color = 'var(--danger-600, #DC2626)';
    logoutLink.innerHTML = '<span class="sidebar-icon">🚪</span> Log Out';
    logoutLink.onclick = (e) => {
      e.preventDefault();
      if (window.ClassoraAuth) window.ClassoraAuth.signOut();
      else window.location.href = '../login.html';
    };
    
    nav.appendChild(logoutSec);
    nav.appendChild(logoutLink);
  }

  // Close sidebar on link click on mobile
  sidebar.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 1024) close();
    });
  });

  // Mark active link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  sidebar.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href')?.split('/').pop() || '';
    if (href === currentPage) link.classList.add('active');
  });
}

/* ─── Dropdown Menu ───────────────────────── */
function initDropdowns() {
  document.querySelectorAll('[data-dropdown]').forEach(trigger => {
    const targetId = trigger.dataset.dropdown;
    const menu = document.getElementById(targetId);
    if (!menu) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
      if (!isOpen) menu.classList.add('open');
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  });
}

/* ─── Tabs ────────────────────────────────── */
function initTabs() {
  document.querySelectorAll('[data-tab-group]').forEach(group => {
    const name = group.dataset.tabGroup;
    const panels = document.querySelectorAll(`[data-tab-panel="${name}"]`);

    group.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        panels.forEach(p => {
          p.style.display = p.dataset.panel === target ? 'block' : 'none';
        });
      });
    });
  });
}

/* ─── Modal ───────────────────────────────── */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

document.addEventListener('click', (e) => {
  if (e.target.matches('[data-modal-open]')) openModal(e.target.dataset.modalOpen);
  if (e.target.matches('[data-modal-close]')) closeModal(e.target.dataset.modalClose);
  if (e.target.matches('.modal-overlay')) closeModal(e.target.id);
});

/* ─── Copy to Clipboard ───────────────────── */
function copyToClipboard(text, feedback = 'Copied!') {
  navigator.clipboard?.writeText(text).then(() => {
    showToast(feedback, 'success', 2000);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(feedback, 'success', 2000);
  });
}

/* ─── Animate on Scroll ───────────────────── */
function initScrollAnimations() {
  const elements = document.querySelectorAll('.animate-fade-up, .animate-fade-in');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
    observer.observe(el);
  });
}

/* ─── Classora ID Generator (mock) ───────── */
function generateClassoraId(role = 'ST') {
  const digits = Math.random().toString().slice(2, 12);
  return `${role}${digits}`;
}

/* ─── Simple Chart (Progress Bars) ───────── */
function animateProgressBars() {
  document.querySelectorAll('.progress-fill').forEach(bar => {
    const target = bar.dataset.progress || bar.style.width || '0%';
    bar.style.width = '0%';
    setTimeout(() => { bar.style.width = target; }, 200);
  });
}

/* ─── Confirm Dialog ──────────────────────── */
function confirmAction(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '9999';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px; text-align:center;">
      <div style="font-size:2.5rem; margin-bottom:12px;">⚠️</div>
      <h4 style="margin-bottom:8px;">Are you sure?</h4>
      <p style="margin-bottom:24px;">${message}</p>
      <div style="display:flex; gap:12px; justify-content:center;">
        <button class="btn btn-ghost" id="confirm-cancel">Cancel</button>
        <button class="btn btn-danger" id="confirm-ok">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#confirm-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirm-ok').addEventListener('click', () => {
    overlay.remove();
    onConfirm?.();
  });
}

/* ─── Dark Mode Toggle ────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('classora-theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('classora-theme', isDark ? 'light' : 'dark');
}

/* ─── Global Directory (Real Verified Teachers & Students) ── */
let CLASSORA_DIRECTORY = [];

// Dynamically populate directory with real registered users from Supabase
async function loadClassoraDirectory() {
  try {
    let list = [];
    try {
      const resp = await fetch('https://xmlzcntqxerfarsdeedf.supabase.co/rest/v1/profiles?select=id,full_name,email,phone,role,classora_id,avatar_url,subject,grade,institute,bio,privacy_settings', {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtbHpjbnRxeGVyZmFyc2RlZWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzg2ODQsImV4cCI6MjEwNjgxNDY4NH0.0eyVcRHkuoBBQVPwjnYgpn9MnM21RM1vqeZaMu_0ECg'
        }
      });
      if (resp.ok) list = await resp.json();
    } catch(e) {
      console.warn('Network fetch profiles warning:', e);
    }

    // Merge active user profile if available
    let localProfile = null;
    try {
      localProfile = JSON.parse(localStorage.getItem('classora_profile') || 'null');
    } catch(e) {}
    if (localProfile && !list.some(p => p.id === localProfile.id || p.classora_id === localProfile.classora_id)) {
      list.unshift(localProfile);
    }

    CLASSORA_DIRECTORY = (list || []).map(p => {
      const isAdmin = p.role === 'admin' || p.classora_id === 'ADM-001';
      const roleName = isAdmin ? 'Admin' : (p.role === 'teacher' ? 'Teacher' : 'Student');
      const fullName = p.full_name || 'Classora Member';
      const initials = fullName.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2) || 'U';
      return {
        id: p.classora_id || (isAdmin ? 'ADM-001' : (p.role === 'teacher' ? 'TCH-USER' : 'STD-USER')),
        uid: p.id,
        name: fullName,
        role: roleName,
        title: isAdmin ? 'Platform Administrator' : (p.role === 'teacher' ? 'Classora Verified Educator' : 'Enrolled Student'),
        classes: p.grade || (p.role === 'teacher' ? 'Academic Classes' : 'Enrolled Classes'),
        subjects: p.subject || (p.role === 'teacher' ? 'General Curriculum' : 'Active Studies'),
        institute: p.institute || '',
        bio: p.bio || '',
        avatar: initials,
        avatar_url: p.avatar_url || null,
        avatarColor: isAdmin ? 'linear-gradient(135deg, #F59E0B, #DC2626)' : 'linear-gradient(135deg, #4F46E5, #7C3AED)',
        email: p.email || '',
        phone: p.phone || '',
        privacy: p.privacy_settings || {
          show_email: false,
          show_phone: false,
          show_institute: true,
          show_classes: true,
          show_bio: true
        },
        status: 'Verified Member'
      };
    });
    if (typeof filterDirectory === 'function') filterDirectory();
  } catch (err) {
    console.warn('Could not fetch public directory:', err);
  }
}

// Load directory on page ready for search modal
if (typeof window !== 'undefined') {
  function setupDirectory() {
    loadClassoraDirectory();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDirectory);
  } else {
    setupDirectory();
  }
}

/* ─── Global Search Modal ─────────────────── */
let currentSearchFilter = 'all';

function createGlobalSearchModal() {
  if (document.getElementById('global-search-modal')) return;

  const modalHtml = `
    <div class="search-modal-overlay" id="global-search-modal">
      <div class="search-modal-card">
        <div class="search-modal-header">
          <span style="font-size:1.25rem; color:var(--primary-600);">🔍</span>
          <input type="text" class="search-modal-input" id="global-search-input" placeholder="Search members by name or Classora ID (e.g. TC..., ST...)" autocomplete="off"/>
          <button class="btn btn-ghost btn-sm" id="close-search-btn" style="padding:4px 8px; font-size:1.1rem;" aria-label="Close search">✕</button>
        </div>

        <div class="search-filter-pills">
          <button class="search-filter-pill active" data-filter="all">All Members</button>
          <button class="search-filter-pill" data-filter="Teacher">🧑‍🏫 Teachers</button>
          <button class="search-filter-pill" data-filter="Student">🎒 Students</button>
        </div>

        <div class="search-results-list" id="search-results-list">
          <!-- Dynamic Results -->
        </div>

        <div style="padding:10px 18px; background:var(--gray-50); border-top:1px solid var(--gray-100); font-size:0.75rem; color:var(--gray-400); display:flex; justify-content:space-between; align-items:center;">
          <span>💡 Press <kbd style="background:#fff;border:1px solid var(--gray-300);border-radius:4px;padding:1px 5px;font-family:monospace;">ESC</kbd> to close</span>
          <span>Universal Classora ID System</span>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById('global-search-modal');
  const input = document.getElementById('global-search-input');
  const closeBtn = document.getElementById('close-search-btn');

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  input.addEventListener('input', (e) => {
    renderSearchResults(e.target.value);
  });

  document.querySelectorAll('.search-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.search-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentSearchFilter = pill.dataset.filter;
      renderSearchResults(input.value);
    });
  });
}

function openGlobalSearch(initialQuery = '') {
  createGlobalSearchModal();
  const modal = document.getElementById('global-search-modal');
  const input = document.getElementById('global-search-input');
  if (modal && input) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    input.value = initialQuery;
    renderSearchResults(initialQuery);
    setTimeout(() => input.focus(), 100);
  }
}

function renderSearchResults(query = '') {
  const list = document.getElementById('search-results-list');
  if (!list) return;

  const q = query.trim().toLowerCase();

  const filtered = CLASSORA_DIRECTORY.filter(item => {
    const matchesFilter = currentSearchFilter === 'all' || item.role === currentSearchFilter;
    const matchesQuery = !q ||
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.subjects.toLowerCase().includes(q) ||
      item.classes.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  if (filtered.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding:36px 16px; color:var(--gray-500);">
        <div style="font-size:2.5rem; margin-bottom:8px;">🔍</div>
        <h4 style="margin-bottom:4px; color:var(--gray-800);">No results found</h4>
        <p style="font-size:0.85rem;">No teacher or student matches "${query}". Try searching by Name or Unique ID format (e.g. TC... or ST...).</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(item => `
    <div class="search-result-item" onclick="handleSearchResultClick('${item.id}', '${item.name}', '${item.role}')">
      <div style="display:flex; align-items:center; gap:12px; min-width:0;">
        <div class="user-avatar avatar-md" style="background:${item.avatarColor}; font-weight:700;">${item.avatar}</div>
        <div style="min-width:0;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong style="color:var(--gray-900); font-size:0.95rem;">${item.name}</strong>
            <span class="badge ${item.role === 'Teacher' ? 'badge-primary' : 'badge-success'}" style="font-size:0.7rem; padding:2px 7px;">${item.role}</span>
          </div>
          <div style="font-size:0.8rem; color:var(--gray-500); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">
            ${item.title} &bull; ${item.classes}
          </div>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
        <code class="classora-id" style="font-size:0.75rem; padding:3px 8px;">${item.id}</code>
        <button class="btn btn-ghost btn-sm" style="padding:4px 8px;" onclick="event.stopPropagation(); copyToClipboard('${item.id}', '${item.role} ID Copied!')" title="Copy Classora ID">📋</button>
      </div>
    </div>
  `).join('');
}

function handleSearchResultClick(id, name, role) {
  openInstagramProfile(id);
}

/* ─── Instagram-Style Profile Viewer ─────────────────────── */
function openInstagramProfile(targetId) {
  // 1. Close search modal if open
  const searchModal = document.getElementById('global-search-modal');
  if (searchModal) {
    searchModal.classList.remove('open');
  }

  // 2. Find target user in global directory
  let member = CLASSORA_DIRECTORY.find(m => m.id === targetId || m.uid === targetId);

  // If not found in directory, check local active user or demo session
  if (!member && window.ClassoraAuth) {
    const curProfile = window.ClassoraAuth.getActiveProfile();
    if (curProfile && (curProfile.classora_id === targetId || curProfile.id === targetId || !targetId)) {
      member = {
        id: curProfile.classora_id || 'TCH-DEMO',
        uid: curProfile.id,
        name: curProfile.full_name || 'Classora User',
        role: curProfile.role === 'student' ? 'Student' : (curProfile.role === 'admin' ? 'Admin' : 'Teacher'),
        title: curProfile.role === 'teacher' ? 'Classora Verified Educator' : 'Enrolled Student',
        classes: curProfile.grade || 'Active Classes',
        subjects: curProfile.subject || 'General Studies',
        institute: curProfile.institute || '',
        bio: curProfile.bio || '',
        avatar: (curProfile.full_name || 'U').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase(),
        avatar_url: curProfile.avatar_url || null,
        avatarColor: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
        email: curProfile.email || '',
        phone: curProfile.phone || '',
        privacy: curProfile.privacy_settings || {
          show_email: false,
          show_phone: false,
          show_institute: true,
          show_classes: true,
          show_bio: true
        }
      };
    }
  }

  if (!member) {
    showToast('Member profile not found in directory.', 'warning');
    return;
  }

  // Ensure modal DOM element exists
  let overlay = document.getElementById('ig-profile-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ig-profile-modal-overlay';
    overlay.className = 'ig-profile-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) closeInstagramProfile();
    };
    document.body.appendChild(overlay);
  }

  // Parse Privacy Settings
  const priv = member.privacy || {
    show_email: false,
    show_phone: false,
    show_institute: true,
    show_classes: true,
    show_bio: true
  };

  const isTeacher = member.role === 'Teacher' || member.role === 'Admin';
  const roleBadge = isTeacher ? '🧑‍🏫 Verified Teacher' : '🎒 Enrolled Student';
  const roleBadgeClass = isTeacher ? 'badge-primary' : 'badge-success';
  const safeId = escapeHTML(member.id);
  const safeName = escapeHTML(member.name);
  const safeBio = priv.show_bio !== false && member.bio ? escapeHTML(member.bio) : (isTeacher ? 'Verified Academic Educator on Classora.' : 'Student actively engaged in enrolled curriculum and classes.');

  // Mask or show email according to user's privacy choices
  let emailDisplay = '';
  if (priv.show_email && member.email) {
    emailDisplay = escapeHTML(member.email);
  } else {
    emailDisplay = '<span style="color:var(--gray-400); font-style:italic;">🔒 Hidden by user</span>';
  }

  // Mask or show phone
  let phoneDisplay = '';
  if (priv.show_phone && member.phone) {
    phoneDisplay = escapeHTML(member.phone);
  } else {
    phoneDisplay = '<span style="color:var(--gray-400); font-style:italic;">🔒 Hidden by user</span>';
  }

  // Institute display
  let instituteDisplay = '';
  if (priv.show_institute !== false && member.institute) {
    instituteDisplay = escapeHTML(member.institute);
  } else if (priv.show_institute === false) {
    instituteDisplay = '<span style="color:var(--gray-400); font-style:italic;">🔒 Private</span>';
  } else {
    instituteDisplay = 'Classora Academic Network';
  }

  // Classes display
  let classesDisplay = '';
  if (priv.show_classes !== false) {
    classesDisplay = escapeHTML(member.classes || (isTeacher ? 'WB / CBSE' : 'Enrolled'));
  } else {
    classesDisplay = '<span style="color:var(--gray-400); font-style:italic;">🔒 Private</span>';
  }

  // Avatar style
  const avatarBg = member.avatar_url ? `url("${member.avatar_url}")` : member.avatarColor;
  const avatarText = member.avatar_url ? '' : member.avatar;

  // Instagram Stat Counters
  const stat1Num = isTeacher ? 'Active' : 'Enrolled';
  const stat1Label = isTeacher ? 'Educator' : 'Status';
  const stat2Num = escapeHTML((member.subjects || 'General').split(',')[0].slice(0, 10));
  const stat2Label = isTeacher ? 'Subject' : 'Course';
  const stat3Num = 'Verified';
  const stat3Label = 'Account';

  overlay.innerHTML = `
    <div class="ig-profile-card animate-fade-up" onclick="event.stopPropagation()">
      <div class="ig-profile-cover">
        <button class="ig-profile-close" onclick="closeInstagramProfile()" aria-label="Close profile">✕</button>
      </div>

      <div class="ig-profile-body">
        <div class="ig-avatar-row">
          <div class="ig-avatar-ring">
            <div class="ig-avatar-img" style="background:${avatarBg}; background-size:cover; background-position:center;">
              ${avatarText}
            </div>
          </div>
          <span class="badge ${roleBadgeClass}" style="font-size:0.78rem; padding:4px 10px; margin-bottom:8px;">${roleBadge}</span>
        </div>

        <div class="ig-header-meta">
          <h3 class="ig-user-name">${safeName} ${isTeacher ? '👑' : ''}</h3>
          <div class="ig-user-handle">
            <span>Classora ID:</span>
            <code>${safeId}</code>
            <button class="btn btn-ghost btn-sm" style="padding:2px 6px; font-size:0.75rem;" onclick="copyToClipboard('${safeId}', 'ID Copied!')" title="Copy ID">📋</button>
          </div>
        </div>

        <div class="ig-stats-row">
          <div class="ig-stat-col">
            <strong>${stat1Num}</strong>
            <span>${stat1Label}</span>
          </div>
          <div class="ig-stat-col">
            <strong>${stat2Num}</strong>
            <span>${stat2Label}</span>
          </div>
          <div class="ig-stat-col">
            <strong style="color:#059669;">${stat3Num}</strong>
            <span>${stat3Label}</span>
          </div>
        </div>

        <div class="ig-bio-box">
          ${safeBio}
        </div>

        <div class="ig-academic-grid">
          <div class="ig-academic-pill">
            <span>📚 Focus / Subjects</span>
            <strong>${escapeHTML(member.subjects || 'Academics')}</strong>
          </div>
          <div class="ig-academic-pill">
            <span>🏫 Institution / School</span>
            <strong>${instituteDisplay}</strong>
          </div>
          <div class="ig-academic-pill">
            <span>🎓 Grade / Level</span>
            <strong>${classesDisplay}</strong>
          </div>
          <div class="ig-academic-pill">
            <span>📧 Email Address</span>
            <strong>${emailDisplay}</strong>
          </div>
        </div>

        <div class="ig-privacy-badge">
          <span>🛡️</span>
          <span>Privacy Protected: Profile owner controls visible public information.</span>
        </div>

        <div class="ig-actions-row">
          <button class="btn btn-primary" onclick="copyToClipboard('${safeId}', 'Classora ID Copied!')">
            📋 Copy Classora ID
          </button>
          <button class="btn btn-secondary" onclick="shareUserProfile('${safeId}', '${safeName}')">
            🔗 Share Profile
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.style.overflow = 'hidden';
  overlay.classList.add('open');
}
window.openInstagramProfile = openInstagramProfile;

function closeInstagramProfile() {
  const overlay = document.getElementById('ig-profile-modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}
window.closeInstagramProfile = closeInstagramProfile;

function shareUserProfile(id, name) {
  const url = `${window.location.origin}/search.html?q=${encodeURIComponent(id)}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast(`Direct profile link for ${name} copied!`, 'success');
    });
  } else {
    showToast(`Share link: ${url}`, 'info');
  }
}
window.shareUserProfile = shareUserProfile;


/* ─── Mobile Bottom Nav Auto-Mount ─────────── */
function initMobileBottomNav() {
  const isTeacher = window.location.pathname.includes('/teacher/');
  const isStudent = window.location.pathname.includes('/student/');

  if (!isTeacher && !isStudent) return;
  if (document.querySelector('.mobile-bottom-nav')) return;

  const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';

  const navHtml = isTeacher ? `
    <nav class="mobile-bottom-nav" aria-label="Mobile Navigation">
      <a href="dashboard.html" class="mobile-nav-item ${currentPath === 'dashboard.html' ? 'active' : ''}">
        <span class="mobile-nav-icon">🏠</span>
        <span>Dashboard</span>
      </a>
      <a href="classrooms.html" class="mobile-nav-item ${currentPath === 'classrooms.html' ? 'active' : ''}">
        <span class="mobile-nav-icon">🏫</span>
        <span>Classes</span>
      </a>
      <a href="#" class="mobile-nav-item" onclick="event.preventDefault(); openGlobalSearch();">
        <span class="mobile-nav-icon">🔍</span>
        <span>Search</span>
      </a>
      <a href="schedule.html" class="mobile-nav-item ${currentPath === 'schedule.html' ? 'active' : ''}">
        <span class="mobile-nav-icon">📅</span>
        <span>Schedule</span>
      </a>
      <a href="profile.html" class="mobile-nav-item ${currentPath === 'profile.html' ? 'active' : ''}">
        <span class="mobile-nav-icon">👤</span>
        <span>Profile</span>
      </a>
    </nav>
  ` : `
    <nav class="mobile-bottom-nav" aria-label="Mobile Navigation">
      <a href="dashboard.html" class="mobile-nav-item ${currentPath === 'dashboard.html' ? 'active' : ''}">
        <span class="mobile-nav-icon">🏠</span>
        <span>Dashboard</span>
      </a>
      <a href="classrooms.html" class="mobile-nav-item ${currentPath === 'classrooms.html' ? 'active' : ''}">
        <span class="mobile-nav-icon">🏫</span>
        <span>Classes</span>
      </a>
      <a href="#" class="mobile-nav-item" onclick="event.preventDefault(); openGlobalSearch();">
        <span class="mobile-nav-icon">🔍</span>
        <span>Search</span>
      </a>
      <a href="homework.html" class="mobile-nav-item ${currentPath === 'homework.html' ? 'active' : ''}">
        <span class="mobile-nav-icon">📚</span>
        <span>Homework</span>
      </a>
      <a href="profile.html" class="mobile-nav-item ${currentPath === 'profile.html' ? 'active' : ''}">
        <span class="mobile-nav-icon">👤</span>
        <span>Profile</span>
      </a>
    </nav>
  `;

  document.body.insertAdjacentHTML('beforeend', navHtml);
}

/* ─── Mobile Portal Topbar Brand & Sidebar Toggle ────────────── */
function initMobileTopbarBrand() {
  const topbar = document.querySelector('.dash-topbar');
  if (!topbar || topbar.querySelector('.mobile-topbar-brand')) return;
  const firstDiv = topbar.querySelector(':scope > div:first-child');
  if (!firstDiv) return;

  // Add hamburger toggle button for mobile (Bug N5)
  if (!document.getElementById('sidebar-toggle')) {
    const sidebarToggle = document.createElement('button');
    sidebarToggle.id = 'sidebar-toggle';
    sidebarToggle.className = 'btn btn-ghost btn-sm mobile-menu-btn';
    sidebarToggle.style.cssText = 'font-size:1.4rem; padding:4px 8px; margin-right:6px; line-height:1; color:var(--gray-800);';
    sidebarToggle.innerHTML = '☰';
    sidebarToggle.setAttribute('aria-label', 'Open navigation menu');
    firstDiv.insertBefore(sidebarToggle, firstDiv.firstChild);
  }

  const brand = document.createElement('a');
  brand.href = '../index.html';
  brand.className = 'navbar-logo mobile-topbar-brand';
  brand.title = 'Classora Home';
  brand.innerHTML = '<div class="logo-icon" style="width:28px; height:28px; font-size:0.8rem; border-radius:8px; margin-right:4px;">C</div>';
  const toggle = document.getElementById('sidebar-toggle');
  if (toggle) {
    firstDiv.insertBefore(brand, toggle.nextSibling);
  } else {
    firstDiv.insertBefore(brand, firstDiv.firstChild);
  }

  // Ensure sidebar overlay exists
  if (!document.getElementById('sidebar-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  initSidebar();
}

/* ─── Topbar Profile Picture / Avatar Navigation ────────────── */
function initTopbarProfileAvatar() {
  const topbar = document.querySelector('.dash-topbar');
  if (!topbar) return;

  const rightActions = topbar.querySelector(':scope > div:last-child');
  if (!rightActions) return;

  const isPortal = window.location.pathname.includes('/teacher/') || window.location.pathname.includes('/student/');
  if (!isPortal) return;

  // Keep right actions in a single clean row
  rightActions.style.flexWrap = 'nowrap';
  rightActions.style.flexShrink = '0';

  let avatarEl = rightActions.querySelector('.user-avatar');
  if (!avatarEl) {
    const link = document.createElement('a');
    link.href = 'profile.html';
    link.className = 'user-avatar avatar-sm topbar-user-avatar';
    link.title = 'My Profile';
    link.style.cssText = 'cursor:pointer; text-decoration:none; flex-shrink:0 !important; font-size:0.8rem; display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:50%; z-index:10;';
    link.innerHTML = '👤';
    rightActions.appendChild(link);
    avatarEl = link;
  } else {
    avatarEl.classList.add('topbar-user-avatar');
    avatarEl.style.cursor = 'pointer';
    avatarEl.style.flexShrink = '0';
    avatarEl.title = 'My Profile';
    if (avatarEl.tagName !== 'A') {
      avatarEl.onclick = () => {
        window.location.href = 'profile.html';
      };
    }
  }
}

window.confirmDeleteClassroom = window.confirmDeleteClassroom || async function(id, name) {
  if (!confirm(`Are you sure you want to permanently delete classroom "${name}"?\n\nThis will remove the classroom and its class code. This action cannot be undone.`)) {
    return;
  }
  showToast(`Deleting classroom "${name}"…`, 'info');
  try {
    if (window.ClassoraAuth) {
      await window.ClassoraAuth.deleteClassroom(id);
      showToast(`Classroom "${name}" deleted successfully.`, 'success');
      window.ClassoraAuth.syncAuthUI();
    }
  } catch (err) {
    showToast('Error deleting classroom: ' + err.message, 'error');
  }
};

/* ─── Init ────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initPasswordToggles();
  initSidebar();
  initDropdowns();
  initTabs();
  initScrollAnimations();
  initTheme();
  animateProgressBars();
  createGlobalSearchModal();
  initMobileBottomNav();
  initMobileTopbarBrand();
  initTopbarProfileAvatar();
  initDesktopModeSuggestion();

  // Attach search triggers
  document.querySelectorAll('.search-input, [data-open-search], #topbar-search').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      // If clicking inside input, open search modal
      openGlobalSearch(el.value || '');
    });
    const inp = el.querySelector('input');
    if (inp) {
      inp.addEventListener('focus', () => openGlobalSearch(inp.value || ''));
    }
  });

  // Keyboard shortcut Ctrl+K or / opens global search, Escape closes modals & drawer
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))) {
      e.preventDefault();
      openGlobalSearch();
    }
    if (e.key === 'Escape') {
      if (typeof window.closeDesktopSuggestion === 'function') {
        window.closeDesktopSuggestion();
      }
      if (typeof window.toggleMobileDrawer === 'function') {
        window.toggleMobileDrawer(false);
      }
      const searchModal = document.getElementById('global-search-modal');
      if (searchModal && searchModal.classList.contains('open')) {
        searchModal.classList.remove('open');
        document.body.style.overflow = '';
      }
      document.querySelectorAll('.modal-overlay.open').forEach(m => {
        m.classList.remove('open');
        document.body.style.overflow = '';
      });
    }
  });
});

/* ─── Global Mobile Drawer Toggle ──────────── */
window.toggleMobileDrawer = function(forceState) {
  const drawer = document.getElementById('mobile-drawer-overlay');
  if (!drawer) return;
  const shouldOpen = typeof forceState === 'boolean' ? forceState : !drawer.classList.contains('open');
  if (shouldOpen) {
    drawer.classList.add('open');
    document.body.classList.add('drawer-open');
  } else {
    drawer.classList.remove('open');
    document.body.classList.remove('drawer-open');
  }
};

/* ─── Standard Board Subjects & Grades (WB & CBSE) ── */
window.CLASSORA_SUBJECTS = [
  "Mathematics",
  "Bengali (বাংলা)",
  "English",
  "Hindi (हिंदी)",
  "General Science",
  "Physical Science (ভৌত বিজ্ঞান)",
  "Life Science (জীবন বিজ্ঞান)",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science / IT",
  "Environmental Studies (EVS)",
  "History (ইতিহাস)",
  "Geography (ভূগোল)",
  "Social Studies (SST)",
  "Political Science (রাষ্ট্রবিজ্ঞান)",
  "Economics (অর্থনীতি)",
  "Accountancy",
  "Business Studies",
  "Statistics",
  "Sociology",
  "Philosophy",
  "Sanskrit",
  "Nutrition",
  "Psychology",
  "Others"
];

window.CLASSORA_GRADES = [
  "LKG",
  "UKG",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12"
];

/* ─── Desktop Mode Suggestion on Smartphone Browsers (First-Time Login Only) ── */
function isSmartphoneDevice() {
  const isNarrow = window.innerWidth <= 850;
  const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTouchPortrait = (navigator.maxTouchPoints > 0) && (window.innerHeight >= window.innerWidth);
  return isNarrow || (isMobileUA && window.innerWidth <= 1024) || isTouchPortrait;
}

function isUserLoggedIn() {
  const isPortal = window.location.pathname.includes('/teacher/') || window.location.pathname.includes('/student/');
  const hasSession = localStorage.getItem('classora_user') || localStorage.getItem('classora_session') || localStorage.getItem('classora_profile');
  return isPortal || !!hasSession;
}

function showDesktopReminder() {
  if (!isSmartphoneDevice()) return;
  if (localStorage.getItem('classora_desktop_reminder_seen') === 'true') return;
  if (!isUserLoggedIn()) return;

  // Don't duplicate if already open
  if (document.getElementById('desktop-suggest-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'desktop-suggest-overlay';
  overlay.id = 'desktop-suggest-overlay';
  overlay.innerHTML = `
    <div class="desktop-suggest-card" onclick="event.stopPropagation()">
      <button class="desktop-suggest-close" onclick="closeDesktopSuggestion()" aria-label="Close suggestion">✕</button>
      <div class="desktop-suggest-icon-wrap">💻</div>
      <h3 class="desktop-suggest-title">Enable Desktop View for Best Experience</h3>
      <p class="desktop-suggest-desc">
        You are currently viewing Classora on a smartphone screen. For the complete workstation experience with multi-column timetables, gradebooks, and analytics, enabling Desktop View is recommended.
      </p>
      <div class="desktop-suggest-tip">
        <div class="desktop-suggest-tip-title">💡 How to enable Desktop Site in your browser:</div>
        <div class="desktop-suggest-tip-body">
          • <strong>Chrome / Android:</strong> Tap top-right menu (<strong>⋮</strong>) ➔ Check <strong>"Desktop site"</strong>.<br/>
          • <strong>Safari / iPhone:</strong> Tap <strong>"aA"</strong> or <strong>⋯</strong> in address bar ➔ Tap <strong>"Request Desktop Website"</strong>.
        </div>
      </div>
      <div class="desktop-suggest-actions" style="margin-top:16px;">
        <button class="btn btn-primary btn-sm btn-full" onclick="closeDesktopSuggestion()" style="width:100%; justify-content:center;">Got It, Continue</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', () => closeDesktopSuggestion());
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add('open');
  }, 400);
}

function initDesktopModeSuggestion() {
  // Bug 19: Disabled automatic desktop popup on mobile.
  // The layout is fully responsive and optimized for phones.
  return;
}

window.closeDesktopSuggestion = function() {
  try {
    localStorage.setItem('classora_desktop_reminder_seen', 'true');
  } catch (e) {}

  const overlay = document.getElementById('desktop-suggest-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 350);
  }
};

