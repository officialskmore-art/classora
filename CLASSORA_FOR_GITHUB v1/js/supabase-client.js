/**
 * Classora — Supabase Integration & Authentication Client
 * Configured for officialskmore@gmail.com's Project
 * Project URL: https://xmlzcntqxerfarsdeedf.supabase.co
 */

const SUPABASE_CONFIG = {
  url: 'https://xmlzcntqxerfarsdeedf.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtbHpjbnRxeGVyZmFyc2RlZWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzg2ODQsImV4cCI6MjEwNjgxNDY4NH0.0eyVcRHkuoBBQVPwjnYgpn9MnM21RM1vqeZaMu_0ECg'
};

class ClassoraAuthService {
  constructor() {
    this.url = SUPABASE_CONFIG.url;
    this.anonKey = SUPABASE_CONFIG.anonKey;
    this.storageKey = 'classora_sb_session';
    this.client = null;
    this.init();
  }

  init() {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      try {
        this.client = window.supabase.createClient(this.url, this.anonKey);
        this.client.auth.onAuthStateChange((event, session) => {
          if (session) {
            this.saveSession(session);
            this.syncAuthUI();
          }
        });
      } catch (e) {
        console.warn('Could not initialize official Supabase client:', e);
      }
    }
  }

  // --- Session & Storage Helpers ---
  saveSession(session) {
    if (session) {
      localStorage.setItem(this.storageKey, JSON.stringify(session));
      if (session.user) {
        localStorage.setItem('classora_user', JSON.stringify(session.user));
      }
    }
  }

  clearSession() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem('classora_user');
    localStorage.removeItem('classora_profile');
    localStorage.removeItem('classora_auth_role');
  }

  getLocalSession() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) return JSON.parse(data);

      // Check standard Supabase client token storage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            if (parsed.access_token) return parsed;
            if (parsed.currentSession) return parsed.currentSession;
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  getCurrentUser() {
    try {
      const session = this.getLocalSession();
      if (session && session.user) return session.user;
      const user = localStorage.getItem('classora_user');
      if (user) return JSON.parse(user);
      return null;
    } catch (e) {
      return null;
    }
  }

  isLoggedIn() {
    return Boolean(this.getCurrentUser());
  }

  isAdmin() {
    const user = this.getCurrentUser();
    const profile = this.getActiveProfile();
    if (!user) return false;
    if (user.email === 'kaitysnehasish@gmail.com') return true;
    return Boolean(profile && profile.role === 'admin');
  }

  async getSession() {
    if (this.client) {
      try {
        const { data, error } = await this.client.auth.getSession();
        if (data && data.session) {
          this.saveSession(data.session);
          return data.session;
        }
      } catch (e) {
        console.warn('Error reading session from client:', e);
      }
    }
    return this.getLocalSession();
  }

  // --- Google OAuth Sign In / Sign Up ---
  async signInWithGoogle(intendedRole = 'teacher') {
    localStorage.setItem('classora_auth_role', intendedRole);
    const origin = window.location.origin;
    const redirectUrl = `${origin}/auth-callback.html`;

    if (this.client) {
      try {
        const { data, error } = await this.client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: { access_type: 'offline', prompt: 'consent' }
          }
        });
        if (error) throw error;
        if (data && data.url) {
          window.location.href = data.url;
          return { success: true };
        }
      } catch (err) {
        console.warn('Supabase JS signInWithOAuth error, fallback to direct redirect:', err);
      }
    }

    const authUrl = `${this.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
    window.location.href = authUrl;
    return { success: true };
  }

  // --- Manual Email & Password Sign Up ---
  async signUp({ email, password, fullName, role = 'student', phone = '', subject = '', grade = '' }) {
    const metaData = {
      full_name: fullName,
      role: email === 'kaitysnehasish@gmail.com' ? 'admin' : role,
      phone: phone,
      subject: subject,
      grade: grade
    };

    if (this.client) {
      try {
        const { data, error } = await this.client.auth.signUp({
          email,
          password,
          options: { data: metaData }
        });
        if (error) throw error;

        if (data.session) {
          this.saveSession(data.session);
          await this.fetchAndStoreProfile(data.user.id, metaData);
        }

        return {
          success: true,
          user: data.user,
          session: data.session,
          requiresEmailConfirmation: !data.session
        };
      } catch (err) {
        console.warn('client.auth.signUp error, fallback to direct REST:', err);
      }
    }

    return this.signUpDirectREST({ email, password, metaData });
  }

  async signUpDirectREST({ email, password, metaData }) {
    try {
      const resp = await fetch(`${this.url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': this.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, data: metaData })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.msg || data.message || data.error_description || 'Signup failed');
      }

      if (data.access_token) {
        const session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: data.user
        };
        this.saveSession(session);
        await this.fetchAndStoreProfile(data.user.id, metaData);
        return { success: true, user: data.user, session, requiresEmailConfirmation: false };
      }

      return { success: true, user: data, session: null, requiresEmailConfirmation: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // --- Manual Email & Password Sign In ---
  async signIn({ email, password }) {
    if (this.client) {
      try {
        const { data, error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) throw error;

        this.saveSession(data.session);
        const profile = await this.fetchAndStoreProfile(data.user.id);
        return { success: true, user: data.user, session: data.session, profile };
      } catch (err) {
        console.warn('client.auth.signInWithPassword error, fallback to direct REST:', err);
      }
    }

    return this.signInDirectREST({ email, password });
  }

  async signInDirectREST({ email, password }) {
    try {
      const resp = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': this.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error_description || data.msg || data.message || 'Invalid email or password');
      }

      const session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user
      };
      this.saveSession(session);
      const profile = await this.fetchAndStoreProfile(data.user.id);
      return { success: true, user: data.user, session, profile };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // --- Sign Out ---
  async signOut() {
    try {
      if (this.client) {
        await this.client.auth.signOut();
      }
    } catch (e) {
      console.warn('SignOut error:', e);
    }
    this.clearSession();
    const isPortal = window.location.pathname.includes('/teacher/') || window.location.pathname.includes('/student/');
    window.location.href = isPortal ? '../index.html' : 'index.html';
  }

  // --- Profile Fetch & Cache ---
  async fetchAndStoreProfile(userId, fallbackMeta = {}) {
    try {
      const session = this.getLocalSession();
      const token = session ? session.access_token : this.anonKey;

      const resp = await fetch(`${this.url}/rest/v1/profiles?id=eq.${userId}&select=*`, {
        headers: {
          'apikey': this.anonKey,
          'Authorization': `Bearer ${token}`
        }
      });

      if (resp.ok) {
        const list = await resp.json();
        if (list && list.length > 0) {
          const profile = list[0];
          if (profile.email === 'kaitysnehasish@gmail.com') {
            profile.role = 'admin';
            profile.classora_id = 'ADM-001';
          }
          localStorage.setItem('classora_profile', JSON.stringify(profile));
          return profile;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch profile from DB:', e);
    }

    const isAdminEmail = fallbackMeta.email === 'kaitysnehasish@gmail.com';
    const cached = {
      id: userId,
      role: isAdminEmail ? 'admin' : (fallbackMeta.role || 'teacher'),
      full_name: fallbackMeta.full_name || 'Classora User',
      email: fallbackMeta.email || '',
      classora_id: isAdminEmail ? 'ADM-001' : (fallbackMeta.role === 'student' ? 'STD-' : 'TCH-') + Math.random().toString(36).substring(2, 8).toUpperCase(),
      avatar_url: null,
      is_setup_completed: isAdminEmail ? true : Boolean(fallbackMeta.is_setup_completed)
    };
    localStorage.setItem('classora_profile', JSON.stringify(cached));
    return cached;
  }

  getActiveProfile() {
    try {
      const p = localStorage.getItem('classora_profile');
      if (p) {
        const parsed = JSON.parse(p);
        if (parsed.email === 'kaitysnehasish@gmail.com') {
          parsed.role = 'admin';
          parsed.classora_id = 'ADM-001';
          parsed.is_setup_completed = true;
        }
        return parsed;
      }

      // If user is logged in, synthesize profile immediately so workspace is NEVER treated as logged out
      const user = this.getCurrentUser();
      if (user) {
        const isAdmin = user.email === 'kaitysnehasish@gmail.com';
        const role = isAdmin ? 'admin' : (user.user_metadata?.role || localStorage.getItem('classora_auth_role') || 'teacher');
        const synth = {
          id: user.id,
          role: role,
          full_name: (user.user_metadata && user.user_metadata.full_name) || (isAdmin ? 'Snehasish Kaity' : user.email.split('@')[0]),
          email: user.email,
          classora_id: isAdmin ? 'ADM-001' : (role === 'student' ? 'STD-' : 'TCH-') + (user.id || Math.random().toString(36)).slice(0, 6).toUpperCase(),
          avatar_url: null,
          is_setup_completed: isAdmin ? true : false
        };
        localStorage.setItem('classora_profile', JSON.stringify(synth));
        if (user.id) this.fetchAndStoreProfile(user.id);
        return synth;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // --- Update Profile in Database ---
  async updateProfile(updates = {}) {
    const user = this.getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    try {
      const resp = await fetch(`${this.url}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': this.anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.message || 'Failed to update profile');
      }

      const list = await resp.json();
      const updated = list[0] || updates;
      
      const current = this.getActiveProfile() || {};
      const merged = Object.assign({}, current, updated);
      if (user.email === 'kaitysnehasish@gmail.com') {
        merged.role = 'admin';
        merged.classora_id = 'ADM-001';
      }
      localStorage.setItem('classora_profile', JSON.stringify(merged));

      this.syncAuthUI();
      return { success: true, profile: merged };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // --- Complete One-Time Profile Setup ---
  async completeProfileSetup({ role, full_name, phone, subject = '', grade = '', institute = '', avatar_url = null }) {
    const user = this.getCurrentUser();
    if (!user) return { success: false, error: 'User session not found. Please log in.' };

    const isAdmin = user.email === 'kaitysnehasish@gmail.com';
    const finalRole = isAdmin ? 'admin' : (role === 'teacher' ? 'teacher' : 'student');

    // Generate unique Classora ID for this role
    let finalId;
    if (isAdmin) {
      finalId = 'ADM-001';
    } else if (finalRole === 'teacher') {
      const num = Math.floor(1000000000 + Math.random() * 9000000000);
      finalId = `TC${num}`;
    } else {
      const num = Math.floor(1000000000 + Math.random() * 9000000000);
      finalId = `ST${num}`;
    }

    const payload = {
      role: finalRole,
      full_name: full_name,
      phone: phone,
      subject: subject || null,
      grade: grade || null,
      institute: institute || null,
      classora_id: finalId,
      is_setup_completed: true,
      updated_at: new Date().toISOString()
    };

    if (avatar_url) {
      payload.avatar_url = avatar_url;
    }

    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    try {
      const resp = await fetch(`${this.url}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': this.anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      let updatedProfile = payload;
      if (resp.ok) {
        const list = await resp.json();
        if (list && list.length > 0) {
          updatedProfile = list[0];
        }
      } else {
        // Upsert if not present
        const upsertResp = await fetch(`${this.url}/rest/v1/profiles`, {
          method: 'POST',
          headers: {
            'apikey': this.anonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(Object.assign({ id: user.id, email: user.email }, payload))
        });
        if (upsertResp.ok) {
          const ulist = await upsertResp.json();
          if (ulist && ulist.length > 0) updatedProfile = ulist[0];
        }
      }

      const cached = Object.assign({ id: user.id, email: user.email }, updatedProfile);
      localStorage.setItem('classora_profile', JSON.stringify(cached));
      localStorage.setItem('classora_auth_role', finalRole);

      return { success: true, profile: cached };
    } catch (err) {
      console.error('Error completing profile setup:', err);
      const fallback = Object.assign({ id: user.id, email: user.email }, payload);
      localStorage.setItem('classora_profile', JSON.stringify(fallback));
      localStorage.setItem('classora_auth_role', finalRole);
      return { success: true, profile: fallback };
    }
  }

  // --- Self-Service Delete My Account ---
  async deleteMyAccount() {
    const user = this.getCurrentUser();
    if (!user) return { success: false, error: 'User is not signed in.' };

    if (user.email === 'kaitysnehasish@gmail.com') {
      return { success: false, error: 'Super Administrator account cannot be deleted.' };
    }

    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    try {
      // 1. Delete profile row from Supabase via authenticated JWT
      await fetch(`${this.url}/rest/v1/profiles?id=eq.${user.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.anonKey,
          'Authorization': `Bearer ${token}`
        }
      });

      // 2. Client signout if initialized
      if (this.client) {
        try {
          await this.client.auth.signOut();
        } catch (e) {
          console.warn('Sign out during deletion error:', e);
        }
      }

      // 3. Clear all session data locally
      this.clearSession();

      return { success: true };
    } catch (err) {
      console.error('Error deleting account:', err);
      return { success: false, error: err.message };
    }
  }

  // --- Upload Profile Photo ---
  async uploadAvatar(file) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('You must be signed in to upload a profile photo.');

    const ext = file.name.split('.').pop() || 'png';
    const filePath = `user-${user.id}-${Date.now()}.${ext}`;

    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    const uploadUrl = `${this.url}/storage/v1/object/avatars/${filePath}`;
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': file.type || 'image/png'
      },
      body: file
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.message || 'Avatar upload failed');
    }

    const publicUrl = `${this.url}/storage/v1/object/public/avatars/${filePath}`;
    await this.updateProfile({ avatar_url: publicUrl });
    return publicUrl;
  }

  // --- Upload Document / PDF / HR Material ---
  async uploadDocument(file, { title, description = '', category = 'study_material', classroomId = null }) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('You must be signed in to upload documents.');

    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${user.id}/${Date.now()}_${cleanName}`;

    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    const uploadUrl = `${this.url}/storage/v1/object/documents/${filePath}`;
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.message || 'File upload failed');
    }

    const publicUrl = `${this.url}/storage/v1/object/public/documents/${filePath}`;
    const ext = file.name.split('.').pop().toLowerCase();
    const docRecord = {
      title: title || file.name,
      description: description,
      file_url: publicUrl,
      file_type: ext,
      file_size_bytes: file.size,
      category: category,
      uploader_id: user.id,
      classroom_id: classroomId
    };

    const dbResp = await fetch(`${this.url}/rest/v1/documents`, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(docRecord)
    });

    if (!dbResp.ok) {
      const dbErr = await dbResp.json();
      throw new Error(dbErr.message || 'Failed to save document metadata');
    }

    const saved = await dbResp.json();
    return saved[0] || docRecord;
  }

  // --- Fetch Documents ---
  async fetchDocuments({ category = null, classroomId = null } = {}) {
    try {
      let queryUrl = `${this.url}/rest/v1/documents?select=*&order=created_at.desc`;
      if (category) queryUrl += `&category=eq.${category}`;
      if (classroomId) queryUrl += `&classroom_id=eq.${classroomId}`;

      const session = this.getLocalSession();
      const token = session ? session.access_token : this.anonKey;

      const resp = await fetch(queryUrl, {
        headers: {
          'apikey': this.anonKey,
          'Authorization': `Bearer ${token}`
        }
      });

      if (resp.ok) return await resp.json();
      return [];
    } catch (e) {
      console.warn('Fetch documents error:', e);
      return [];
    }
  }

  // --- Create Classroom ---
  async createClassroom({ name, subject, section = '', description = '' }) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('You must be signed in to create a classroom.');

    const subCode = (subject || 'CLS').slice(0, 3).toUpperCase();
    const code = `${subCode}-${Math.floor(100 + Math.random() * 900)}`;

    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    const classroomData = {
      name: name,
      subject: subject,
      section: section,
      class_code: code,
      description: description,
      teacher_id: user.id
    };

    const resp = await fetch(`${this.url}/rest/v1/classrooms`, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(classroomData)
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.message || 'Failed to create classroom');
    }

    const saved = await resp.json();
    return saved[0] || classroomData;
  }

  // --- Fetch Classrooms ---
  async fetchClassrooms() {
    const user = this.getCurrentUser();
    if (!user) return [];

    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    try {
      const url = this.isAdmin()
        ? `${this.url}/rest/v1/classrooms?select=*&order=created_at.desc`
        : `${this.url}/rest/v1/classrooms?teacher_id=eq.${user.id}&select=*&order=created_at.desc`;

      const resp = await fetch(url, {
        headers: {
          'apikey': this.anonKey,
          'Authorization': `Bearer ${token}`
        }
      });

      if (resp.ok) return await resp.json();
      return [];
    } catch (e) {
      console.warn('Fetch classrooms error:', e);
      return [];
    }
  }

  // --- Universal UI & Workspace Synchronizer ---
  syncAuthUI() {
    const user = this.getCurrentUser();
    const profile = this.getActiveProfile();
    const isLogged = Boolean(user);

    if (isLogged) {
      const isAdmin = this.isAdmin();
      const currentPath = window.location.pathname.toLowerCase();
      const isSetupPage = currentPath.endsWith('setup-profile.html');
      const isPublicOrAuthPage = isSetupPage ||
        currentPath.endsWith('login.html') ||
        currentPath.endsWith('register-teacher.html') ||
        currentPath.endsWith('register-student.html') ||
        currentPath.endsWith('auth-callback.html') ||
        currentPath.endsWith('index.html') ||
        currentPath.endsWith('about.html') ||
        currentPath.endsWith('search.html') ||
        currentPath.endsWith('forgot-password.html') ||
        currentPath === '/' ||
        currentPath.endsWith('/');

      // Redirect uncompleted profiles to one-time setup if attempting to access workspaces/portals
      if (!isAdmin && profile && profile.is_setup_completed !== true && !isPublicOrAuthPage) {
        const isPortal = currentPath.includes('/teacher/') || currentPath.includes('/student/');
        window.location.href = isPortal ? '../setup-profile.html' : 'setup-profile.html';
        return;
      }

      const isTeacherPortal = currentPath.includes('/teacher/');
      const isStudentPortal = currentPath.includes('/student/');
      const fullName = profile.full_name || 'Classora User';
      const firstName = fullName.split(' ')[0];
      const initials = fullName.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2) || firstName.charAt(0);
      const cid = isAdmin ? 'ADM-001' : (profile.classora_id || 'TCH-USER');
      const role = isAdmin ? (isStudentPortal ? 'student' : 'teacher') : (profile.role || 'teacher');
      const email = profile.email || user.email || '';

      // 1. Sidebar User Pill: Set Real User Credentials
      document.querySelectorAll('.sidebar-user').forEach(card => {
        const nameEl = card.querySelector('div > div:first-child');
        if (nameEl) nameEl.textContent = isAdmin ? 'Snehasish Kaity 👑' : fullName;
        const idEl = card.querySelector('.classora-id');
        if (idEl) {
          if (isAdmin) {
            idEl.textContent = isStudentPortal ? 'ADM-001 (Student Mode)' : 'ADM-001 (Teacher Mode)';
            idEl.style.background = 'linear-gradient(135deg, #F59E0B, #DC2626)';
            idEl.style.color = '#fff';
            idEl.style.fontWeight = '700';
          } else {
            idEl.textContent = cid;
          }
        }
      });

      // 2. Avatar Elements: Use Clean Typographic Initials with Gradients
      document.querySelectorAll('.user-avatar, #avatar-preview').forEach(av => {
        if (profile.avatar_url) {
          av.style.backgroundImage = `url("${profile.avatar_url}")`;
          av.style.backgroundSize = 'cover';
          av.style.backgroundPosition = 'center';
          av.style.color = 'transparent';
        } else {
          av.style.backgroundImage = 'none';
          av.style.background = isAdmin ? 'linear-gradient(135deg, #F59E0B, #DC2626)' : 'linear-gradient(135deg, #4F46E5, #7C3AED)';
          av.style.color = '#fff';
          av.style.fontWeight = '700';
          av.textContent = isAdmin ? '👑' : initials;
        }
        av.setAttribute('title', isAdmin ? 'Super Administrator (Dual Privilege)' : fullName);
      });

      // 3. Topbar Greetings
      document.querySelectorAll('.dash-topbar div, .dash-topbar span').forEach(el => {
        if (el.children.length === 0) {
          if (el.textContent.includes('Ms. Priya') || el.textContent.includes('Rohan') || el.textContent.includes('Hello, Student!')) {
            el.textContent = el.textContent
              .replace(/Ms\. Priya Sharma/g, fullName)
              .replace(/Ms\. Priya/g, firstName)
              .replace(/Rohan Verma/g, fullName)
              .replace(/Rohan/g, firstName)
              .replace(/Hello, Student!/g, `Hello, ${firstName}! 👑`);
          }
        }
      });

      // 4. Welcome Banners
      document.querySelectorAll('.welcome-banner, .welcome-student-banner').forEach(banner => {
        const h2 = banner.querySelector('h2');
        const p = banner.querySelector('p');
        const badge = banner.querySelector('div > div:first-child');

        if (isAdmin) {
          if (isStudentPortal) {
            if (badge) badge.textContent = '👑 SUPER ADMIN • DUAL ACCESS MODE';
            if (h2) h2.innerHTML = `Welcome to Student Portal, ${firstName}! 🎒`;
            if (p) p.innerHTML = `Root Administrative Console active in Student Mode. Experience learning dashboards, enroll in any classroom, and test student homework & exams directly.`;
          } else {
            if (badge) badge.textContent = '👑 SUPER ADMIN WORKSPACE';
            if (h2) h2.innerHTML = `Welcome back, ${firstName}! 👑`;
            if (p) p.innerHTML = `Root Administrative Console active with dual Teacher & Student superpowers. Full governance and classroom management.`;
          }
        } else {
          if (h2) h2.textContent = `Welcome back, ${firstName}!`;
          if (p) p.textContent = `This is your official Classora workspace. Manage your classrooms, schedules, and materials.`;
        }
      });

      // Inject Super Admin Portal Switcher into Topbar and User Dropdown
      if (isAdmin && (isTeacherPortal || isStudentPortal)) {
        const topbarActions = document.querySelector('.dash-topbar > div:last-child');
        if (topbarActions && !document.getElementById('super-admin-switcher-btn')) {
          const switcherLink = document.createElement('a');
          switcherLink.id = 'super-admin-switcher-btn';
          switcherLink.className = 'btn btn-sm';
          if (isTeacherPortal) {
            switcherLink.href = '../student/dashboard.html';
            switcherLink.style.cssText = 'background:linear-gradient(135deg, #4F46E5, #7C3AED); color:#fff; font-weight:700; border:none; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(79,70,229,0.3); padding:6px 14px; border-radius:var(--radius-md); text-decoration:none; margin-right:4px;';
            switcherLink.innerHTML = '<span>🎒</span> Switch to Student Portal';
            switcherLink.title = 'Super Admin Dual Privilege: Open Student Portal View';
          } else {
            switcherLink.href = '../teacher/dashboard.html';
            switcherLink.style.cssText = 'background:linear-gradient(135deg, #D97706, #DC2626); color:#fff; font-weight:700; border:none; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(220,38,38,0.3); padding:6px 14px; border-radius:var(--radius-md); text-decoration:none; margin-right:4px;';
            switcherLink.innerHTML = '<span>🧑‍🏫</span> Switch to Teacher Portal';
            switcherLink.title = 'Super Admin Dual Privilege: Open Teacher Portal View';
          }
          topbarActions.insertBefore(switcherLink, topbarActions.firstChild);
        }

        const dropdown = document.getElementById('user-dropdown');
        if (dropdown && !document.getElementById('super-admin-dropdown-switcher')) {
          const dropItem = document.createElement('a');
          dropItem.id = 'super-admin-dropdown-switcher';
          dropItem.className = 'dropdown-item-link';
          dropItem.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:0.875rem;font-weight:700;border-bottom:1px solid var(--gray-100);';
          if (isTeacherPortal) {
            dropItem.href = '../student/dashboard.html';
            dropItem.style.color = '#4F46E5';
            dropItem.innerHTML = '🎒 Switch to Student Portal';
          } else {
            dropItem.href = '../teacher/dashboard.html';
            dropItem.style.color = '#DC2626';
            dropItem.innerHTML = '🧑‍🏫 Switch to Teacher Portal';
          }
          dropdown.insertBefore(dropItem, dropdown.firstChild);
        }
      }

      // 5. Replace any remaining demo IDs (TC5839201746, ST7416382059)
      document.querySelectorAll('.classora-id, code').forEach(code => {
        if (code.textContent.includes('TC5839201746') || code.textContent.includes('ST7416382059') || code.textContent.includes('TC5') || code.textContent.includes('ST7')) {
          code.textContent = cid;
        }
      });

      // 6. Profile Settings Page Inputs
      const profNameInput = document.getElementById('prof-name') || document.getElementById('first-name');
      if (profNameInput && !profNameInput.dataset.userEdited) profNameInput.value = fullName;

      const emailInput = document.getElementById('current-email') || document.getElementById('reg-email');
      if (emailInput && !emailInput.dataset.userEdited) emailInput.value = email;

      const phoneInput = document.getElementById('prof-phone');
      if (phoneInput && profile.phone && !phoneInput.dataset.userEdited) phoneInput.value = profile.phone;

      const titleInput = document.getElementById('prof-title');
      if (titleInput && !titleInput.dataset.userEdited) {
        titleInput.value = isAdmin ? 'Platform Super Administrator (Dual Privilege)' : (profile.subject ? `${profile.subject} Educator` : 'Educator');
      }

      const qualInput = document.getElementById('prof-qual');
      if (qualInput && profile.qualification && !qualInput.dataset.userEdited) qualInput.value = profile.qualification;

      const bioInput = document.getElementById('prof-bio');
      if (bioInput && profile.bio && !bioInput.dataset.userEdited) bioInput.value = profile.bio;

      const profileCard = document.querySelector('.card h3');
      if (profileCard && (profileCard.textContent.includes('Ms. Priya') || profileCard.textContent.includes('Rohan'))) {
        profileCard.textContent = fullName;
      }

      // 7. Wire up Sign Out
      document.querySelectorAll('a[href*="login.html"]').forEach(link => {
        if (link.textContent.includes('Sign Out') || link.textContent.includes('Logout')) {
          link.href = '#';
          link.onclick = (e) => {
            e.preventDefault();
            ClassoraAuth.signOut();
          };
        }
      });

      // 8. Public Navbar update
      const navbarActions = document.querySelector('.navbar-actions');
      if (navbarActions) {
        if (isAdmin) {
          navbarActions.innerHTML = `
            <a href="teacher/dashboard.html" class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;">
              <span>🧑‍🏫</span> Teacher Portal
            </a>
            <a href="student/dashboard.html" class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;">
              <span>🎒</span> Student Portal
            </a>
            <button class="btn btn-ghost btn-sm" onclick="ClassoraAuth.signOut()" style="font-weight:600;">
              Sign Out
            </button>
          `;
        } else {
          const signinBtn = Array.from(navbarActions.querySelectorAll('a')).find(a => a.textContent.includes('Sign In'));
          const getStartedBtn = Array.from(navbarActions.querySelectorAll('a')).find(a => a.textContent.includes('Get Started'));
          const targetDash = role === 'student' ? 'student/dashboard.html' : 'teacher/dashboard.html';

          if (signinBtn) {
            signinBtn.href = targetDash;
            signinBtn.innerHTML = `<span>${role === 'teacher' ? '🧑‍🏫' : '🎒'}</span> ${firstName}'s Portal`;
            signinBtn.classList.remove('btn-ghost');
            signinBtn.classList.add('btn-secondary');
          }
          if (getStartedBtn) {
            getStartedBtn.href = '#';
            getStartedBtn.textContent = 'Sign Out';
            getStartedBtn.classList.remove('btn-primary');
            getStartedBtn.classList.add('btn-ghost');
            getStartedBtn.onclick = (e) => {
              e.preventDefault();
              ClassoraAuth.signOut();
            };
          }
        }
      }

      // 9. CLEAN WORKSPACE ACROSS ALL PORTAL PAGES (ZERO DEMO DATA FOR LOGGED-IN USERS)
      this.cleanWorkspaceForLoggedInUser({ isAdmin, fullName, firstName, cid, role });

    } else {
      // Logged out: keep clean portal states
    }
  }

  // --- Completely replaces demo lists with real empty states or live database data across ALL portal pages ---
  async cleanWorkspaceForLoggedInUser({ isAdmin, fullName, firstName, cid, role }) {
    const path = window.location.pathname.toLowerCase();

    // ───────────────────────────────────────────
    // 1. TEACHER DASHBOARD (teacher/dashboard.html)
    // ───────────────────────────────────────────
    if (path.includes('/teacher/dashboard.html')) {
      const classrooms = await this.fetchClassrooms();

      // Stats KPI Cards
      const statsGrid = document.querySelector('.stats-grid');
      if (statsGrid) {
        const stats = statsGrid.querySelectorAll('.card-stat');
        if (stats.length >= 4) {
          stats[0].querySelector('div > div:first-child').textContent = classrooms.length;
          stats[0].querySelector('div > div:nth-child(2)').textContent = 'Active Classrooms';
          stats[1].querySelector('div > div:first-child').textContent = '0';
          stats[1].querySelector('div > div:nth-child(2)').textContent = 'Active Students';
          stats[2].querySelector('div > div:first-child').textContent = '0';
          stats[2].querySelector('div > div:nth-child(2)').textContent = 'Pending Requests';
          stats[3].querySelector('div > div:first-child').textContent = '0';
          stats[3].querySelector('div > div:nth-child(2)').textContent = 'Upcoming Exams';
        }
      }

      // Clear demo students list
      const studentsList = document.getElementById('students-list');
      if (studentsList) {
        studentsList.innerHTML = `
          <div style="text-align:center; padding:32px 16px; border:1.5px dashed var(--gray-200); border-radius:var(--radius-lg); margin-top:8px;">
            <div style="font-size:2rem; margin-bottom:8px;">👥</div>
            <h5 style="margin-bottom:4px; color:var(--gray-800);">No enrolled students yet</h5>
            <p style="font-size:0.8rem; color:var(--gray-500); margin-bottom:12px;">Share your unique Classora ID with students to start enrolling.</p>
            <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${cid}', 'Classora ID Copied!')">📋 Copy Your ID (${cid})</button>
          </div>
        `;
      }

      // Clear demo exams list
      const examsContainer = document.querySelector('.grid-2 > div:nth-child(2) > div:last-child');
      if (examsContainer) {
        examsContainer.innerHTML = `
          <div style="text-align:center; padding:32px 16px; border:1.5px dashed var(--gray-200); border-radius:var(--radius-lg); margin-top:8px;">
            <div style="font-size:2rem; margin-bottom:8px;">📝</div>
            <h5 style="margin-bottom:4px; color:var(--gray-800);">No upcoming exams</h5>
            <p style="font-size:0.8rem; color:var(--gray-500); margin-bottom:12px;">Your schedule is clear. Plan and schedule your first assessment.</p>
            <a href="exams.html" class="btn btn-primary btn-sm">➕ Schedule Exam</a>
          </div>
        `;
      }

      // Clear demo classrooms card (lines 356-386)
      const classroomsCard = document.querySelector('.grid-2:nth-of-type(2) > div:first-child > div:last-of-type, .dash-content > .grid-2:last-of-type > div:first-child > div:last-of-type');
      if (classroomsCard) {
        if (classrooms.length === 0) {
          classroomsCard.innerHTML = `
            <div style="text-align:center; padding:28px 16px; border:1.5px dashed var(--gray-200); border-radius:var(--radius-lg);">
              <div style="font-size:2rem; margin-bottom:8px;">🏫</div>
              <h5 style="margin-bottom:4px; color:var(--gray-800);">No active classrooms</h5>
              <p style="font-size:0.8rem; color:var(--gray-500); margin-bottom:12px;">Create your first class to generate a Class Code.</p>
              <a href="classrooms.html" class="btn btn-primary btn-sm">+ Create Classroom</a>
            </div>
          `;
        }
      }

      // Clear demo notifications (lines 397-436)
      const notifsCard = document.querySelector('.grid-2:nth-of-type(2) > div:last-child > div:last-of-type, .dash-content > .grid-2:last-of-type > div:last-child > div:last-of-type');
      if (notifsCard) {
        notifsCard.innerHTML = `
          <div style="text-align:center; padding:28px 16px; border:1.5px dashed var(--gray-200); border-radius:var(--radius-lg);">
            <div style="font-size:2rem; margin-bottom:8px;">🔔</div>
            <h5 style="margin-bottom:4px; color:var(--gray-800);">All caught up!</h5>
            <p style="font-size:0.8rem; color:var(--gray-500); margin:0;">No new notifications or join requests.</p>
          </div>
        `;
      }

      // Super Admin Panel for Snehasish Kaity
      if (isAdmin && !document.getElementById('admin-super-panel')) {
        const content = document.querySelector('.dash-content');
        if (content) {
          const panel = document.createElement('div');
          panel.id = 'admin-super-panel';
          panel.className = 'card animate-fade-up';
          panel.style.cssText = 'background:linear-gradient(135deg, #1E1B4B, #312E81); color:#fff; border:1px solid #4338CA; margin-bottom:24px; padding:24px; border-radius:var(--radius-xl); box-shadow:var(--shadow-md);';
          panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
              <div>
                <span class="badge" style="background:rgba(255,255,255,0.2); color:#fff; margin-bottom:8px; display:inline-block;">👑 ROOT SUPER ADMIN PRIVILEGES</span>
                <h3 style="color:#fff; margin-bottom:6px;">Administrator Governance Console</h3>
                <p style="color:rgba(255,255,255,0.8); font-size:0.875rem; max-width:620px; margin:0; line-height:1.6;">
                  Logged in as Platform Administrator (<strong>kaitysnehasish@gmail.com</strong>). Strict privacy isolation active: students and teachers cannot see confidential data belonging to others.
                </p>
              </div>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <a href="../search.html" class="btn btn-white btn-sm">🔍 Inspect Directory</a>
                <a href="classrooms.html" class="btn btn-sm" style="background:rgba(255,255,255,0.15); color:#fff; border:1px solid rgba(255,255,255,0.3);">Manage All Classes</a>
              </div>
            </div>
          `;
          content.insertBefore(panel, content.querySelector('.stats-grid'));
        }
      }
    }

    // ───────────────────────────────────────────
    // 2. TEACHER SCHEDULE / CALENDAR (teacher/schedule.html)
    // ───────────────────────────────────────────
    if (path.includes('/teacher/schedule.html') || path.includes('/student/schedule.html')) {
      // Clear all demo timetable session badges!
      document.querySelectorAll('.timetable-grid .slot-cell').forEach(cell => {
        cell.innerHTML = '';
      });
      // Add motivating note
      if (!document.getElementById('schedule-empty-note')) {
        const grid = document.querySelector('.timetable-grid');
        if (grid) {
          const note = document.createElement('div');
          note.id = 'schedule-empty-note';
          note.style.cssText = 'background:var(--gray-50); border:1.5px dashed var(--gray-200); border-radius:var(--radius-lg); padding:16px; margin-bottom:20px; text-align:center; font-size:0.875rem; color:var(--gray-600);';
          note.innerHTML = `📅 <strong>Your official weekly timetable is clear.</strong> Click <strong>"➕ Schedule Session"</strong> above to schedule live classes or events.`;
          grid.parentNode.insertBefore(note, grid);
        }
      }
    }

    // ───────────────────────────────────────────
    // 3. TEACHER EXAMINATIONS (teacher/exams.html)
    // ───────────────────────────────────────────
    if (path.includes('/teacher/exams.html')) {
      const stats = document.querySelectorAll('.card-stat');
      if (stats.length >= 3) {
        stats[0].querySelector('div > div:first-child').textContent = '0';
        stats[1].querySelector('div > div:first-child').textContent = '0';
        stats[2].querySelector('div > div:first-child').textContent = '0';
      }
      const tbody = document.querySelector('.table-wrapper table tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center; padding:56px 20px;">
              <div style="font-size:2.5rem; margin-bottom:8px;">📝</div>
              <h4 style="color:var(--gray-800); margin-bottom:4px;">No Scheduled Examinations</h4>
              <p style="font-size:0.875rem; color:var(--gray-500); margin-bottom:16px;">Plan tests, midterms, or quizzes and track marks.</p>
              <button class="btn btn-primary btn-sm" onclick="openModal('modal-create-exam')">➕ Schedule First Exam</button>
            </td>
          </tr>
        `;
      }
    }

    // ───────────────────────────────────────────
    // 4. TEACHER HOMEWORK (teacher/homework.html)
    // ───────────────────────────────────────────
    if (path.includes('/teacher/homework.html')) {
      const hwGrid = document.querySelector('.dash-content .grid');
      if (hwGrid) {
        hwGrid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:56px 20px; border:2px dashed var(--gray-200); border-radius:var(--radius-xl); background:var(--gray-50);">
            <div style="font-size:2.5rem; margin-bottom:8px;">📚</div>
            <h4 style="color:var(--gray-800); margin-bottom:4px;">No Homework Assigned Yet</h4>
            <p style="font-size:0.875rem; color:var(--gray-500); margin-bottom:16px;">Create assignments, attach worksheets/PDFs, and review submissions.</p>
            <button class="btn btn-primary btn-sm" onclick="openModal('modal-create-hw')">➕ Assign First Homework</button>
          </div>
        `;
      }
    }

    // ───────────────────────────────────────────
    // 5. TEACHER STUDENTS (teacher/students.html)
    // ───────────────────────────────────────────
    if (path.includes('/teacher/students.html')) {
      const filter = document.getElementById('class-filter');
      if (filter) {
        filter.innerHTML = '<option value="all">All Classrooms (0)</option>';
      }
      const tbody = document.querySelector('#students-table tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; padding:56px 20px;">
              <div style="font-size:2.5rem; margin-bottom:8px;">👥</div>
              <h4 style="color:var(--gray-800); margin-bottom:4px;">No Students Enrolled Yet</h4>
              <p style="font-size:0.875rem; color:var(--gray-500); margin-bottom:16px;">Share your Classora ID (<strong>${cid}</strong>) with students so they can join your classrooms.</p>
              <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${cid}', 'Classora ID Copied!')">📋 Copy Your ID (${cid})</button>
            </td>
          </tr>
        `;
      }
    }

    // ───────────────────────────────────────────
    // 6. TEACHER JOIN REQUESTS (teacher/join-requests.html)
    // ───────────────────────────────────────────
    if (path.includes('/teacher/join-requests.html')) {
      const container = document.querySelector('.dash-content .grid') || document.querySelector('.dash-content > div:last-child');
      if (container) {
        container.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:56px 20px; border:2px dashed var(--gray-200); border-radius:var(--radius-xl); background:var(--gray-50);">
            <div style="font-size:2.5rem; margin-bottom:8px;">📩</div>
            <h4 style="color:var(--gray-800); margin-bottom:4px;">No Pending Join Requests</h4>
            <p style="font-size:0.875rem; color:var(--gray-500); margin:0;">When students request to join your classes, their applications will appear here.</p>
          </div>
        `;
      }
    }

    // ───────────────────────────────────────────
    // 7. TEACHER CLASSROOMS (teacher/classrooms.html)
    // ───────────────────────────────────────────
    if (path.includes('/teacher/classrooms.html')) {
      const container = document.getElementById('classrooms-container');
      if (container) {
        const classrooms = await this.fetchClassrooms();
        container.innerHTML = '';
        if (classrooms.length === 0) {
          container.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:64px 20px; border:2px dashed var(--gray-200); border-radius:var(--radius-xl); background:var(--gray-50);">
              <div style="font-size:3rem; margin-bottom:12px;">🏫</div>
              <h3 style="margin-bottom:6px; color:var(--gray-800);">Your Classroom Roster is Empty</h3>
              <p style="font-size:0.9rem; color:var(--gray-500); max-width:440px; margin:0 auto 20px;">
                Create your first class to generate a unique Class Code and start organizing subjects, students, and materials.
              </p>
              <button class="btn btn-primary" onclick="openModal('modal-new-class')">➕ Create First Classroom</button>
            </div>
          `;
        } else {
          classrooms.forEach(c => {
            const card = document.createElement('div');
            card.className = 'class-card';
            card.dataset.category = 'active';
            card.innerHTML = `
              <div class="class-card-header card-grad-1">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <span class="badge" style="background:rgba(255,255,255,0.2); color:#fff;">${c.section || 'General'}</span>
                  <span class="badge" style="background:rgba(255,255,255,0.25); color:#fff;">Code: ${c.class_code}</span>
                </div>
                <h3 style="color:#fff; margin-top:12px; margin-bottom:4px;">${c.name}</h3>
                <div style="font-size:0.85rem; opacity:0.85;">${c.subject || 'Academic'}</div>
              </div>
              <div class="class-card-body">
                <div class="class-meta-row">
                  <span>👥 Enrolled Students</span>
                  <strong style="color:var(--gray-900);">0 Students</strong>
                </div>
                <div class="class-meta-row">
                  <span>📝 Description</span>
                  <strong style="color:var(--gray-900);">${c.description || 'Active classroom'}</strong>
                </div>
                <div style="display:flex; gap:8px; margin-top:auto; padding-top:12px;">
                  <a href="students.html?class=${c.class_code}" class="btn btn-secondary btn-sm" style="flex:1;">View Students</a>
                  <button class="btn btn-ghost btn-sm" onclick="copyToClipboard('${c.class_code}', 'Class Code Copied!')">📋 Code</button>
                </div>
              </div>
            `;
            container.appendChild(card);
          });
        }
      }
    }

    // ───────────────────────────────────────────
    // 8. TEACHER RESULTS & PROGRESS (teacher/results.html, teacher/progress.html)
    // ───────────────────────────────────────────
    if (path.includes('/teacher/results.html')) {
      const tbody = document.querySelector('table tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; padding:56px 20px;">
              <div style="font-size:2.5rem; margin-bottom:8px;">📊</div>
              <h4 style="color:var(--gray-800); margin-bottom:4px;">No Exam Results Recorded</h4>
              <p style="font-size:0.875rem; color:var(--gray-500); margin:0;">Results will be recorded here once you conduct an exam and grade student papers.</p>
            </td>
          </tr>
        `;
      }
    }
    if (path.includes('/teacher/progress.html')) {
      const card = document.querySelector('.dash-content .card');
      if (card) {
        card.innerHTML = `
          <div style="text-align:center; padding:48px 20px;">
            <div style="font-size:2.5rem; margin-bottom:8px;">📈</div>
            <h4 style="color:var(--gray-800); margin-bottom:4px;">No Progress Analytics Yet</h4>
            <p style="font-size:0.875rem; color:var(--gray-500); margin:0;">Student attendance and academic performance graphs will generate after classes begin.</p>
          </div>
        `;
      }
    }

    // ───────────────────────────────────────────
    // 9. TEACHER NOTIFICATIONS (teacher/notifications.html)
    // ───────────────────────────────────────────
    if (path.includes('/teacher/notifications.html')) {
      const list = document.querySelector('.dash-content .card') || document.querySelector('.dash-content > div');
      if (list) {
        list.innerHTML = `
          <div style="text-align:center; padding:56px 20px;">
            <div style="font-size:2.5rem; margin-bottom:8px;">🔔</div>
            <h4 style="color:var(--gray-800); margin-bottom:4px;">No Notifications</h4>
            <p style="font-size:0.875rem; color:var(--gray-500); margin:0;">You are all caught up! System alerts and student activities will appear here.</p>
          </div>
        `;
      }
    }

    // ───────────────────────────────────────────
    // 10. STUDENT WORKSPACE (student/*.html)
    // ───────────────────────────────────────────
    if (path.includes('/student/dashboard.html')) {
      const classrooms = isAdmin ? await this.fetchClassrooms() : [];
      const statsGrid = document.querySelector('.stats-grid');
      if (statsGrid) {
        const stats = statsGrid.querySelectorAll('.card-stat');
        if (stats.length >= 2) {
          stats[0].querySelector('div > div:first-child').textContent = isAdmin ? classrooms.length : '0';
          stats[0].querySelector('div > div:nth-child(2)').textContent = isAdmin ? 'Available Classrooms' : 'Enrolled Classes';
        }
      }
      const classesCard = document.querySelector('.grid-2 > div:first-child > div:last-child');
      if (classesCard) {
        if (isAdmin && classrooms.length > 0) {
          classesCard.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${classrooms.slice(0, 3).map(c => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border:1px solid var(--gray-200); border-radius:var(--radius-md); background:#fff;">
                  <div>
                    <strong style="color:var(--gray-900); font-size:0.9rem;">${c.name}</strong>
                    <div style="font-size:0.75rem; color:var(--gray-500);">${c.subject || 'Academic'} • Code: ${c.class_code}</div>
                  </div>
                  <a href="classrooms.html" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 10px;">Enter Class</a>
                </div>
              `).join('')}
              <a href="classrooms.html" class="btn btn-primary btn-sm btn-full" style="margin-top:4px;">View All Classrooms (${classrooms.length})</a>
            </div>
          `;
        } else {
          classesCard.innerHTML = `
            <div style="text-align:center; padding:32px 16px; border:1.5px dashed var(--gray-200); border-radius:var(--radius-lg);">
              <div style="font-size:2rem; margin-bottom:8px;">🏫</div>
              <h5 style="margin-bottom:4px; color:var(--gray-800);">${isAdmin ? 'No classrooms created on platform' : 'Not enrolled in any classes'}</h5>
              <p style="font-size:0.8rem; color:var(--gray-500); margin-bottom:12px;">${isAdmin ? 'Create classrooms in Teacher Portal to test them in Student Mode.' : 'Ask your teacher for their Classroom Code and click Join Class.'}</p>
              <a href="${isAdmin ? '../teacher/classrooms.html' : 'classrooms.html'}" class="btn btn-primary btn-sm">${isAdmin ? '➕ Create Classroom' : '➕ Join a Class'}</a>
            </div>
          `;
        }
      }
      const examCard = document.querySelector('.grid-2 > div:nth-child(2) > div.card:last-child > div:last-child');
      if (examCard) {
        examCard.innerHTML = `
          <div style="text-align:center; padding:24px 16px; border:1.5px dashed var(--gray-200); border-radius:var(--radius-lg);">
            <p style="font-size:0.85rem; color:var(--gray-500); margin:0;">No upcoming exams scheduled.</p>
          </div>
        `;
      }
    }
    if (path.includes('/student/classrooms.html')) {
      const grid = document.querySelector('.dash-content .grid') || document.getElementById('classrooms-container');
      if (grid) {
        const classrooms = isAdmin ? await this.fetchClassrooms() : [];
        if (isAdmin && classrooms.length > 0) {
          grid.innerHTML = '';
          classrooms.forEach(c => {
            const card = document.createElement('div');
            card.className = 'class-card';
            card.innerHTML = `
              <div class="class-card-header card-grad-1">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <span class="badge" style="background:rgba(255,255,255,0.25); color:#fff;">👑 Admin Student View</span>
                  <span class="badge" style="background:rgba(255,255,255,0.25); color:#fff;">Code: ${c.class_code}</span>
                </div>
                <h3 style="color:#fff; margin-top:12px; margin-bottom:4px;">${c.name}</h3>
                <div style="font-size:0.85rem; opacity:0.85;">${c.subject || 'Academic'} • ${c.section || 'General'}</div>
              </div>
              <div class="class-card-body">
                <div class="class-meta-row">
                  <span>👑 Privilege</span>
                  <strong style="color:var(--primary-700);">Super Admin Dual Access</strong>
                </div>
                <div class="class-meta-row">
                  <span>📝 Description</span>
                  <strong style="color:var(--gray-900);">${c.description || 'Active classroom'}</strong>
                </div>
                <div style="display:flex; gap:8px; margin-top:auto; padding-top:12px;">
                  <a href="homework.html?class=${c.class_code}" class="btn btn-primary btn-sm" style="flex:1;">🎒 View Homework</a>
                  <a href="exams.html?class=${c.class_code}" class="btn btn-secondary btn-sm" style="flex:1;">📝 Take Exams</a>
                </div>
              </div>
            `;
            grid.appendChild(card);
          });
        } else {
          grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:56px 20px; border:2px dashed var(--gray-200); border-radius:var(--radius-xl); background:var(--gray-50);">
              <div style="font-size:2.5rem; margin-bottom:8px;">🏫</div>
              <h4 style="color:var(--gray-800); margin-bottom:4px;">No Enrolled Classrooms</h4>
              <p style="font-size:0.875rem; color:var(--gray-500); margin-bottom:16px;">Enter your teacher's unique Classroom Code to join.</p>
              <button class="btn btn-primary btn-sm" onclick="openModal('modal-join-class')">➕ Join Classroom</button>
            </div>
          `;
        }
      }
    }
    if (path.includes('/student/homework.html')) {
      const grid = document.querySelector('.dash-content .grid');
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:56px 20px; border:2px dashed var(--gray-200); border-radius:var(--radius-xl); background:var(--gray-50);">
            <div style="font-size:2.5rem; margin-bottom:8px;">📚</div>
            <h4 style="color:var(--gray-800); margin-bottom:4px;">No Pending Homework</h4>
            <p style="font-size:0.875rem; color:var(--gray-500); margin:0;">You have no homework due. Great job staying up to date!</p>
          </div>
        `;
      }
    }
    if (path.includes('/student/exams.html')) {
      const tbody = document.querySelector('table tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center; padding:56px 20px;">
              <div style="font-size:2.5rem; margin-bottom:8px;">📝</div>
              <h4 style="color:var(--gray-800); margin-bottom:4px;">No Upcoming Exams</h4>
              <p style="font-size:0.875rem; color:var(--gray-500); margin:0;">Your exam schedule is completely clear.</p>
            </td>
          </tr>
        `;
      }
    }
    if (path.includes('/student/teachers.html')) {
      const grid = document.querySelector('.dash-content .grid');
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:56px 20px; border:2px dashed var(--gray-200); border-radius:var(--radius-xl); background:var(--gray-50);">
            <div style="font-size:2.5rem; margin-bottom:8px;">🧑‍🏫</div>
            <h4 style="color:var(--gray-800); margin-bottom:4px;">No Connected Teachers</h4>
            <p style="font-size:0.875rem; color:var(--gray-500); margin:0;">Teachers will appear here once you enroll in their classes.</p>
          </div>
        `;
      }
    }
    if (path.includes('/student/results.html')) {
      const card = document.querySelector('.dash-content .card');
      if (card) {
        card.innerHTML = `
          <div style="text-align:center; padding:48px 20px;">
            <div style="font-size:2.5rem; margin-bottom:8px;">📊</div>
            <h4 style="color:var(--gray-800); margin-bottom:4px;">No Results Yet</h4>
            <p style="font-size:0.875rem; color:var(--gray-500); margin:0;">Your test scores and report cards will appear here after examinations are graded.</p>
          </div>
        `;
      }
    }
    if (path.includes('/teacher/notes.html') || path.includes('/student/notes.html')) {
      const grid = document.querySelector('.dash-content .grid');
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:56px 20px; border:2px dashed var(--gray-200); border-radius:var(--radius-xl); background:var(--gray-50);">
            <div style="font-size:2.5rem; margin-bottom:8px;">🗒️</div>
            <h4 style="color:var(--gray-800); margin-bottom:4px;">No Notes Uploaded Yet</h4>
            <p style="font-size:0.875rem; color:var(--gray-500); margin:0;">Study guides, formulas, and lecture handouts will appear here.</p>
          </div>
        `;
      }
    }
    if (path.includes('/student/downloads.html')) {
      const grid = document.querySelector('.dash-content .grid') || document.querySelector('.dash-content > div:last-child');
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:56px 20px; border:2px dashed var(--gray-200); border-radius:var(--radius-xl); background:var(--gray-50);">
            <div style="font-size:2.5rem; margin-bottom:8px;">📄</div>
            <h4 style="color:var(--gray-800); margin-bottom:4px;">No Official Documents Yet</h4>
            <p style="font-size:0.875rem; color:var(--gray-500); margin:0;">Formal term report cards and certificates will be available for download here.</p>
          </div>
        `;
      }
    }
  }
}

// Global instance
window.ClassoraAuth = new ClassoraAuthService();

// Run immediately and also on DOMContentLoaded
function runClassoraInit() {
  window.ClassoraAuth.syncAuthUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runClassoraInit);
} else {
  runClassoraInit();
}
