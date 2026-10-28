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
    this.realtime = new ClassoraRealtimeManager(this);
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
    try {
      sessionStorage.removeItem('classora_signed_out');
    } catch (e) {}
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
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('supabase.'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    try {
      sessionStorage.setItem('classora_signed_out', 'true');
    } catch (e) {}
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
            redirectTo: redirectUrl
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
      role: role,
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
        if (error) {
          // Do not retry with secondary REST on auth failure (prevents duplicate 400 error - Bug 27)
          return { success: false, error: error.message };
        }

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
      if (this.realtime) {
        this.realtime.unsubscribeAll();
      }
      if (this.client) {
        await this.client.auth.signOut();
      }
    } catch (e) {
      console.warn('SignOut error:', e);
    }
    this.clearSession();
    const isPortal = window.location.pathname.includes('/teacher/') || window.location.pathname.includes('/student/');
    window.location.href = isPortal ? '../login.html' : 'login.html';
  }

  // --- Quick Demo Login (for Instant Preview and Local Testing) ---
  quickDemoLogin(role = 'teacher') {
    const isTeacher = role === 'teacher';
    const dummyUser = {
      id: isTeacher ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002',
      email: isTeacher ? 'teacher@classora.com' : 'student@classora.com',
      user_metadata: {
        full_name: isTeacher ? 'Snehasish Kaity' : 'Alex Johnson',
        role: role,
        is_setup_completed: true
      }
    };
    const dummyProfile = {
      id: dummyUser.id,
      email: dummyUser.email,
      full_name: dummyUser.user_metadata.full_name,
      role: role,
      classora_id: isTeacher ? 'TCH-DEMO1' : 'STD-DEMO1',
      avatar_url: null,
      is_setup_completed: true
    };
    localStorage.setItem('classora_user', JSON.stringify(dummyUser));
    localStorage.setItem('classora_profile', JSON.stringify(dummyProfile));
    localStorage.setItem('classora_session', JSON.stringify({ access_token: 'demo-token', user: dummyUser }));
    return { success: true, user: dummyUser, profile: dummyProfile };
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
          localStorage.setItem('classora_profile', JSON.stringify(profile));
          return profile;
        }
      }

      // Profile does not exist in DB yet (e.g. initial OAuth login before trigger ran)
      const user = this.getCurrentUser();
      const meta = (user && user.user_metadata) || fallbackMeta || {};
      const role = meta.role || fallbackMeta.role || localStorage.getItem('classora_auth_role') || 'student';
      const fullName = meta.full_name || meta.name || fallbackMeta.full_name || (user && user.email ? user.email.split('@')[0] : 'Classora User');
      const email = (user && user.email) || fallbackMeta.email || '';
      const prefix = role === 'student' ? 'STD-' : 'TCH-';
      const classoraId = prefix + Math.random().toString(36).substring(2, 8).toUpperCase();

      const newProfile = {
        id: userId,
        email: email,
        full_name: fullName,
        role: role,
        classora_id: classoraId,
        avatar_url: meta.avatar_url || meta.picture || null,
        is_setup_completed: Boolean(meta.is_setup_completed || fallbackMeta.is_setup_completed)
      };

      if (session && session.access_token) {
        try {
          const createResp = await fetch(`${this.url}/rest/v1/profiles`, {
            method: 'POST',
            headers: {
              'apikey': this.anonKey,
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(newProfile)
          });
          if (createResp.ok) {
            const created = await createResp.json();
            if (created && created[0]) {
              localStorage.setItem('classora_profile', JSON.stringify(created[0]));
              return created[0];
            }
          }
        } catch (provErr) {
          console.warn('Auto-provisioning profile in DB failed:', provErr);
        }
      }

      localStorage.setItem('classora_profile', JSON.stringify(newProfile));
      return newProfile;
    } catch (e) {
      console.warn('Failed to fetch profile from DB:', e);
    }

    const isAdmin = fallbackMeta.role === 'admin';
    const cached = {
      id: userId,
      role: isAdmin ? 'admin' : (fallbackMeta.role || 'teacher'),
      full_name: fallbackMeta.full_name || 'Classora User',
      email: fallbackMeta.email || '',
      classora_id: isAdmin ? 'ADM-001' : (fallbackMeta.role === 'student' ? 'STD-' : 'TCH-') + Math.random().toString(36).substring(2, 8).toUpperCase(),
      avatar_url: null,
      is_setup_completed: isAdmin ? true : Boolean(fallbackMeta.is_setup_completed)
    };
    localStorage.setItem('classora_profile', JSON.stringify(cached));
    return cached;
  }

  getActiveProfile() {
    try {
      const p = localStorage.getItem('classora_profile');
      if (p) {
        return JSON.parse(p);
      }

      // If user is logged in, synthesize profile from session metadata
      const user = this.getCurrentUser();
      if (user) {
        const role = user.user_metadata?.role || localStorage.getItem('classora_auth_role') || 'teacher';
        const synth = {
          id: user.id,
          role: role,
          full_name: (user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0],
          email: user.email,
          classora_id: (role === 'student' ? 'STD-' : 'TCH-') + (user.id || Math.random().toString(36)).slice(0, 6).toUpperCase(),
          avatar_url: null,
          is_setup_completed: false
        };
        localStorage.setItem('classora_profile', JSON.stringify(synth));
        if (user.id) this.fetchAndStoreProfile(user.id);
        return synth;
      }

      // Unauthenticated visitor: Return null so protected portal pages cannot be accessed (Bug 8 & 9)
      return null;
    } catch (e) {
      return null;
    }
  }

  // --- Update Profile in Database & Local Storage ---
  async updateProfile(updates = {}) {
    // 1. Always merge and persist to localStorage first so local preview & offline always works!
    const current = this.getActiveProfile() || {};
    const merged = Object.assign({}, current, updates);
    const user = this.getCurrentUser();
    localStorage.setItem('classora_profile', JSON.stringify(merged));

    // Refresh UI elements
    this.syncAuthUI();

    // 2. If no remote user is authenticated, return success immediately with local merge
    if (!user) {
      return { success: true, profile: merged };
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
        body: JSON.stringify(updates)
      });

      if (!resp.ok) {
        console.warn('Remote profile update warn, kept local storage:', resp.status);
        return { success: true, profile: merged };
      }

      const list = await resp.json();
      const updated = list[0] || updates;
      const remoteMerged = Object.assign({}, merged, updated);
      localStorage.setItem('classora_profile', JSON.stringify(remoteMerged));
      this.syncAuthUI();
      return { success: true, profile: remoteMerged };
    } catch (err) {
      console.warn('Supabase update warning, profile retained locally:', err);
      return { success: true, profile: merged };
    }
  }

  // --- Complete One-Time Profile Setup ---
  async completeProfileSetup({ role, full_name, phone, subject = '', grade = '', institute = '', avatar_url = null }) {
    const user = this.getCurrentUser();
    if (!user) return { success: false, error: 'User session not found. Please log in.' };

    const isAdmin = this.isAdmin();
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

    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    try {
      // 1. Call SECURITY DEFINER RPC to delete auth.users AND profile (Bug N4)
      const rpcResp = await fetch(`${this.url}/rest/v1/rpc/delete_user_account`, {
        method: 'POST',
        headers: {
          'apikey': this.anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!rpcResp.ok) {
        // Fallback: Delete profile row from Supabase via authenticated JWT
        await fetch(`${this.url}/rest/v1/profiles?id=eq.${user.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': this.anonKey,
            'Authorization': `Bearer ${token}`
          }
        });
      }

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

  // --- Update Password (for email and Google users) (Bug N2) ---
  async updatePassword(newPassword) {
    if (this.client) {
      try {
        const { data, error } = await this.client.auth.updateUser({ password: newPassword });
        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (e) {
        console.warn('updateUser password error:', e);
      }
    }
    const session = this.getLocalSession();
    if (!session || !session.access_token) return { success: false, error: 'User session not found' };
    const resp = await fetch(`${this.url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': this.anonKey,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    });
    if (!resp.ok) {
      const err = await resp.json();
      return { success: false, error: err.msg || err.message || 'Failed to update password' };
    }
    return { success: true };
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

  // --- Create Text / Document Record without requiring a binary upload ---
  async createDocument({ title, description = '', category = 'study_material', classroomId = null, fileUrl = '' }) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('You must be signed in to create documents.');
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    const docRecord = {
      title,
      description,
      file_url: fileUrl || null,
      file_type: fileUrl ? fileUrl.split('.').pop().toLowerCase() : 'text',
      file_size_bytes: 0,
      category,
      uploader_id: user.id,
      classroom_id: (classroomId && classroomId !== 'general' && classroomId !== 'private') ? classroomId : null
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
      throw new Error(dbErr.message || 'Failed to save note');
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
  // --- Create Classroom ---
  async createClassroom({ name, subject, section = '', description = '' }) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('You must be signed in to create a classroom.');

    const subCode = (subject || 'CLS').slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'C') || 'CLS';
    const code = `${subCode}-${Math.floor(100 + Math.random() * 900)}`;

    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    const classroomData = {
      id: 'cls-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      name: name,
      subject: subject,
      section: section,
      class_code: code,
      description: description,
      teacher_id: user.id,
      created_at: new Date().toISOString()
    };

    if (token && token !== 'demo-token') {
      try {
        const resp = await fetch(`${this.url}/rest/v1/classrooms`, {
          method: 'POST',
          headers: {
            'apikey': this.anonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            name: name,
            subject: subject,
            section: section,
            class_code: code,
            description: description,
            teacher_id: user.id
          })
        });

        if (resp.ok) {
          const saved = await resp.json();
          return saved[0] || classroomData;
        }
      } catch (err) {
        console.warn('DB classroom creation failed, saving to local demo storage:', err);
      }
    }

    // Save to demo local storage for instant offline / preview reactivity
    const demoClasses = JSON.parse(localStorage.getItem('classora_demo_classrooms') || '[]');
    demoClasses.unshift(classroomData);
    localStorage.setItem('classora_demo_classrooms', JSON.stringify(demoClasses));
    return classroomData;
  }

  // --- Fetch Classrooms ---
  async fetchClassrooms() {
    const user = this.getCurrentUser();
    if (!user) return [];

    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    let dbClassrooms = [];
    if (token && token !== 'demo-token') {
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

        if (resp.ok) dbClassrooms = await resp.json();
      } catch (e) {
        console.warn('Fetch classrooms error:', e);
      }
    }

    const demoClasses = JSON.parse(localStorage.getItem('classora_demo_classrooms') || '[]');
    const existingCodes = new Set(dbClassrooms.map(c => c.class_code));
    const merged = [...dbClassrooms, ...demoClasses.filter(c => !existingCodes.has(c.class_code))];
    return merged;
  }

  // --- Delete Classroom ---
  async deleteClassroom(idOrCode) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('You must be signed in to delete a classroom.');

    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    // Remove from local demo list if present
    const demoClasses = JSON.parse(localStorage.getItem('classora_demo_classrooms') || '[]');
    const filtered = demoClasses.filter(c => c.id !== idOrCode && c.class_code !== idOrCode);
    localStorage.setItem('classora_demo_classrooms', JSON.stringify(filtered));

    if (token && token !== 'demo-token') {
      try {
        const isCode = !idOrCode.includes('-');
        let deleteUrl = `${this.url}/rest/v1/classrooms?${isCode ? 'class_code' : 'id'}=eq.${idOrCode}`;
        if (!this.isAdmin()) {
          deleteUrl += `&teacher_id=eq.${user.id}`;
        }

        const resp = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'apikey': this.anonKey,
            'Authorization': `Bearer ${token}`
          }
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          console.warn('DB classroom deletion returned error:', err);
        }
      } catch (e) {
        console.warn('Delete classroom DB call error:', e);
      }
    }

    return { success: true };
  }

  // --- Timetable Sessions ---
  async fetchSessions({ weekOffset = 0 } = {}) {
    try {
      const user = this.getCurrentUser();
      if (!user) return [];
      const session = this.getLocalSession();
      const token = session ? session.access_token : this.anonKey;
      const resp = await fetch(`${this.url}/rest/v1/sessions?week_offset=eq.${weekOffset}&select=*,classrooms(name,class_code)&order=start_time.asc`, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) return await resp.json();
      return [];
    } catch (e) {
      console.warn('Fetch sessions error:', e);
      return [];
    }
  }

  async createSession({ classroom_id, topic, day_of_week, start_time, week_offset = 0 }) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('You must be signed in to schedule a session.');
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    const payload = {
      teacher_id: user.id,
      classroom_id,
      topic,
      day_of_week,
      start_time,
      week_offset
    };
    const resp = await fetch(`${this.url}/rest/v1/sessions`, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.message || 'Failed to schedule session');
    }
    const saved = await resp.json();
    return saved[0] || payload;
  }

  // --- Universal UI & Workspace Synchronizer ---
  syncAuthUI() {
    // 0. Auto-demo parameter for instant preview without login barriers (?demo=teacher or ?demo=student)
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('demo');
    if (demoParam && (demoParam === 'teacher' || demoParam === 'student')) {
      this.quickDemoLogin(demoParam);
    }

    const user = this.getCurrentUser();
    const profile = this.getActiveProfile();
    const isLogged = Boolean(user) && Boolean(profile);
    const currentPath = window.location.pathname.toLowerCase();
    const isTeacherPortal = currentPath.includes('/teacher/');
    const isStudentPortal = currentPath.includes('/student/');
    const isPortal = isTeacherPortal || isStudentPortal;

    // 1. Unauthenticated portal protection (Bugs 8 & 9)
    if (isPortal && !isLogged) {
      this.clearSession();
      window.location.replace('../login.html');
      return;
    }

    if (isLogged && profile) {
      const isAdmin = this.isAdmin();

      // 2. Role enforcement across portals (Bugs 8 & 9)
      if (isPortal && !isAdmin) {
        if (isTeacherPortal && profile.role === 'student') {
          window.location.replace('../student/dashboard.html');
          return;
        }
        if (isStudentPortal && profile.role === 'teacher') {
          window.location.replace('../teacher/dashboard.html');
          return;
        }
      }

      const isSetupPage = currentPath.includes('setup-profile');
      const isPublicOrAuthPage = isSetupPage ||
        currentPath.includes('login') ||
        currentPath.includes('register-teacher') ||
        currentPath.includes('register-student') ||
        currentPath.includes('auth-callback') ||
        currentPath.includes('index') ||
        currentPath.includes('about') ||
        currentPath.includes('search') ||
        currentPath.includes('forgot-password') ||
        currentPath === '/' ||
        currentPath.endsWith('/');

      // Redirect uncompleted profiles to one-time setup if attempting to access workspaces/portals (only if genuinely logged in)
      if (!isAdmin && profile.is_setup_completed === false && !isPublicOrAuthPage) {
        window.location.replace(isPortal ? '../setup-profile.html' : 'setup-profile.html');
        return;
      }

      // Update dynamic sidebar badges asynchronously
      this.updateSidebarBadges({ isTeacherPortal, isStudentPortal, isAdmin });

      const fullName = profile.full_name || 'Classora User';
      const firstName = fullName.split(' ')[0];
      const initials = fullName.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2) || firstName.charAt(0);
      if (!profile.classora_id) {
        profile.classora_id = isAdmin ? 'ADM-001' : ((isStudentPortal || profile.role === 'student' ? 'STD-' : 'TCH-') + (profile.id ? profile.id.slice(0, 6).toUpperCase() : Math.floor(100000 + Math.random() * 900000)));
        try { localStorage.setItem('classora_profile', JSON.stringify(profile)); } catch (e) {}
      }
      const cid = isAdmin ? 'ADM-001' : profile.classora_id;
      const role = isAdmin ? (isStudentPortal ? 'student' : 'teacher') : (profile.role || (isStudentPortal ? 'student' : 'teacher'));
      const email = (profile && profile.email) || (user && user.email) || '';

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
          av.textContent = '';
        } else {
          av.style.backgroundImage = 'none';
          av.style.background = isAdmin ? 'linear-gradient(135deg, #F59E0B, #DC2626)' : 'linear-gradient(135deg, #4F46E5, #7C3AED)';
          av.style.color = '#fff';
          av.style.fontWeight = '700';
          av.textContent = isAdmin ? '👑' : initials;
        }
        av.setAttribute('title', isAdmin ? 'Super Administrator (Dual Privilege) — Click to view My Profile' : `${fullName} — Click to view My Profile`);
        if (av.closest('.dash-topbar') || av.classList.contains('topbar-user-avatar')) {
          av.style.cursor = 'pointer';
          av.onclick = () => { window.location.href = 'profile.html'; };
        }
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
              .replace(/Hello, Student!/g, `Hello, ${firstName}! 🎒`);
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

      // 5. Universal Classora ID injection across Welcome Banners, Profile Badges, and sidebars
      const teacherBannerId = document.getElementById('teacher-display-id');
      if (teacherBannerId) teacherBannerId.textContent = cid;

      const studentBannerId = document.getElementById('user-display-id');
      if (studentBannerId) studentBannerId.textContent = cid;

      const teacherProfileId = document.getElementById('profile-display-id');
      if (teacherProfileId) teacherProfileId.textContent = cid;

      const studentProfileId = document.getElementById('student-profile-id');
      if (studentProfileId) studentProfileId.textContent = cid;

      // Update all sidebar-user and dashboard Classora ID elements
      document.querySelectorAll('.sidebar-user .classora-id, .welcome-banner .classora-id, .welcome-student-banner .classora-id').forEach(el => {
        el.textContent = cid;
      });

      // Catch-all: Update any remaining placeholders that say "Loading ID...", "Active", or legacy demo IDs
      document.querySelectorAll('.classora-id').forEach(code => {
        const text = code.textContent.trim();
        if (text === 'Loading ID...' || text === 'Active' || text === 'STD-ACTIVE' || text === 'TCH-USER' || text.includes('TC5839201746') || text.includes('ST7416382059') || text.includes('ST0000000000')) {
          code.textContent = cid;
        }
      });

      // 6. Profile Settings Page Inputs
      const profNameInput = document.getElementById('prof-name') || document.getElementById('first-name');
      if (profNameInput && !profNameInput.dataset.userEdited) profNameInput.value = fullName;

      const emailInput = document.getElementById('current-email') || document.getElementById('reg-email');
      if (emailInput && !emailInput.dataset.userEdited) emailInput.value = email;

      const phoneInput = document.getElementById('prof-phone');
      if (phoneInput && !phoneInput.dataset.userEdited) phoneInput.value = profile.phone || '';

      const titleInput = document.getElementById('prof-title');
      if (titleInput && !titleInput.dataset.userEdited) {
        titleInput.value = isAdmin ? 'Platform Super Administrator (Dual Privilege)' : (profile.subject ? `${profile.subject} Educator` : 'Educator');
      }

      const qualInput = document.getElementById('prof-qual');
      if (qualInput && profile.qualification && !qualInput.dataset.userEdited) qualInput.value = profile.qualification;

      const bioInput = document.getElementById('prof-bio');
      if (bioInput && profile.bio && !bioInput.dataset.userEdited) bioInput.value = profile.bio;

      // Identity badges
      const badgeStdName = document.getElementById('badge-student-name');
      if (badgeStdName) badgeStdName.textContent = fullName;
      const badgeStdId = document.getElementById('student-profile-id');
      if (badgeStdId) badgeStdId.textContent = cid;

      const profileDispName = document.getElementById('profile-display-name');
      if (profileDispName) profileDispName.textContent = fullName;
      const profileDispId = document.getElementById('profile-display-id');
      if (profileDispId) profileDispId.textContent = cid;
      const profileDispTitle = document.getElementById('profile-display-title');
      if (profileDispTitle) {
        profileDispTitle.textContent = isAdmin ? 'Super Administrator' : (profile.subject ? `${profile.subject} Educator` : 'Academic Educator');
      }

      // Subject & Grade selects
      const subjSelect = document.getElementById('prof-subject');
      if (subjSelect && profile.subject) {
        let matched = false;
        for (let i = 0; i < subjSelect.options.length; i++) {
          if (subjSelect.options[i].value === profile.subject) {
            subjSelect.selectedIndex = i;
            matched = true;
            break;
          }
        }
        if (!matched) {
          subjSelect.value = 'Others';
          const customInp = document.getElementById('prof-subject-custom');
          if (customInp) {
            customInp.style.display = 'block';
            customInp.value = profile.subject;
          }
        }
      }

      const gradesSelect = document.getElementById('prof-grades');
      if (gradesSelect && profile.grade) {
        for (let i = 0; i < gradesSelect.options.length; i++) {
          if (gradesSelect.options[i].value === profile.grade) {
            gradesSelect.selectedIndex = i;
            break;
          }
        }
      }

      const classLevelSelect = document.getElementById('class-level');
      if (classLevelSelect && profile.grade) {
        for (let i = 0; i < classLevelSelect.options.length; i++) {
          if (classLevelSelect.options[i].value === profile.grade) {
            classLevelSelect.selectedIndex = i;
            break;
          }
        }
      }

      const profileCard = document.querySelector('.card h3');
      if (profileCard && (profileCard.textContent.includes('Ms. Priya') || profileCard.textContent.includes('Rohan'))) {
        profileCard.textContent = fullName;
      }

      // 7. Wire up all Sign Out / Logout links and buttons
      document.querySelectorAll('a, button').forEach(el => {
        const txt = el.textContent || '';
        if (txt.includes('Sign Out') || txt.includes('Logout') || txt.includes('Log Out')) {
          if (el.tagName === 'A') el.href = '#';
          el.onclick = (e) => {
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

  // --- Dynamic Sidebar Badges Updater (Bugs 4, 14, 20) ---
  async updateSidebarBadges({ isTeacherPortal, isStudentPortal, isAdmin }) {
    try {
      if (isTeacherPortal) {
        const classrooms = await this.fetchClassrooms();
        const pending = await this.fetchJoinRequests({ status: 'pending' });
        const clsBadge = document.querySelector('#nav-classrooms .sidebar-badge');
        if (clsBadge) clsBadge.textContent = classrooms.length;
        const joinBadge = document.querySelector('#nav-join .sidebar-badge');
        if (joinBadge) {
          joinBadge.textContent = pending.length;
          joinBadge.style.display = pending.length > 0 ? 'inline-block' : 'none';
        }
        const notifBadge = document.querySelector('#nav-notif .sidebar-badge');
        if (notifBadge) notifBadge.style.display = 'none';
      } else if (isStudentPortal) {
        const enrolled = isAdmin ? await this.fetchClassrooms() : await this.fetchEnrolledClassrooms();
        const assignments = await this.fetchAssignments();
        const clsBadge = document.querySelector('#nav-classrooms .sidebar-badge') || document.getElementById('student-class-count');
        if (clsBadge) clsBadge.textContent = enrolled.length;
        const hwBadge = document.querySelector('#nav-homework .sidebar-badge');
        if (hwBadge) {
          hwBadge.textContent = assignments.length;
          hwBadge.style.display = assignments.length > 0 ? 'inline-block' : 'none';
        }
        const notifBadge = document.querySelector('#nav-notif .sidebar-badge');
        if (notifBadge) notifBadge.style.display = 'none';
      }
    } catch (e) {
      console.warn('Error updating sidebar badges:', e);
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
      const pendingReqs = await this.fetchJoinRequests({ status: 'pending' });
      const students = await this.fetchStudentsForTeacher();
      const exams = await this.fetchExams();

      // Stats KPI Cards
      const statsGrid = document.querySelector('.stats-grid');
      if (statsGrid) {
        const stats = statsGrid.querySelectorAll('.card-stat');
        if (stats.length >= 4) {
          const s0_1 = stats[0].querySelector('div > div:first-child');
          const s0_2 = stats[0].querySelector('div > div:nth-child(2)');
          if (s0_1) s0_1.textContent = classrooms.length;
          if (s0_2) s0_2.textContent = 'Active Classrooms';

          const s1_1 = stats[1].querySelector('div > div:first-child');
          const s1_2 = stats[1].querySelector('div > div:nth-child(2)');
          if (s1_1) s1_1.textContent = students.length;
          if (s1_2) s1_2.textContent = 'Active Students';

          const s2_1 = stats[2].querySelector('div > div:first-child');
          const s2_2 = stats[2].querySelector('div > div:nth-child(2)');
          if (s2_1) s2_1.textContent = pendingReqs.length;
          if (s2_2) s2_2.textContent = 'Pending Requests';

          const s3_1 = stats[3].querySelector('div > div:first-child');
          const s3_2 = stats[3].querySelector('div > div:nth-child(2)');
          if (s3_1) s3_1.textContent = exams.length;
          if (s3_2) s3_2.textContent = 'Upcoming Exams';
        }
      }

      // Render real students list if available, or polite empty state (Bug 20)
      const studentsList = document.getElementById('students-list');
      if (studentsList) {
        if (!students || students.length === 0) {
          studentsList.innerHTML = `
            <div style="text-align:center; padding:32px 16px; border:1.5px dashed var(--gray-200); border-radius:var(--radius-lg); margin-top:8px;">
              <div style="font-size:2rem; margin-bottom:8px;">👥</div>
              <h5 style="margin-bottom:4px; color:var(--gray-800);">No enrolled students yet</h5>
              <p style="font-size:0.8rem; color:var(--gray-500); margin-bottom:12px;">Share your unique Classora ID with students to start enrolling.</p>
              <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${cid}', 'Classora ID Copied!')">📋 Copy Your ID (${cid})</button>
            </div>
          `;
        } else {
          studentsList.innerHTML = students.slice(0, 5).map(s => {
            const p = s.profiles || {};
            const c = s.classrooms || {};
            const name = (p.full_name || 'Student');
            const studentCid = (p.classora_id || s.student_id);
            const clsName = (c.name || 'Classroom');
            const initials = name.charAt(0).toUpperCase();
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border:1px solid var(--gray-200); border-radius:var(--radius-md); background:#fff; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <div class="user-avatar avatar-sm" style="background:var(--grad-primary); color:#fff; font-weight:700;">${initials}</div>
                  <div>
                    <strong style="color:var(--gray-900); font-size:0.875rem;">${name}</strong>
                    <div style="font-size:0.75rem; color:var(--gray-500);">${clsName} • <code>${studentCid}</code></div>
                  </div>
                </div>
                <span class="badge badge-success">Active</span>
              </div>
            `;
          }).join('') + (students.length > 5 ? `<a href="students.html" class="btn btn-secondary btn-sm btn-full" style="margin-top:6px;">View All ${students.length} Students</a>` : '');
        }
      }

      // Render real exams if available
      const examsContainer = document.querySelector('.grid-2 > div:nth-child(2) > div:last-child');
      if (examsContainer) {
        if (!exams || exams.length === 0) {
          examsContainer.innerHTML = `
            <div style="text-align:center; padding:32px 16px; border:1.5px dashed var(--gray-200); border-radius:var(--radius-lg); margin-top:8px;">
              <div style="font-size:2rem; margin-bottom:8px;">📝</div>
              <h5 style="margin-bottom:4px; color:var(--gray-800);">No upcoming exams</h5>
              <p style="font-size:0.8rem; color:var(--gray-500); margin-bottom:12px;">Your schedule is clear. Plan and schedule your first assessment.</p>
              <a href="exams.html" class="btn btn-primary btn-sm">➕ Schedule Exam</a>
            </div>
          `;
        } else {
          examsContainer.innerHTML = exams.slice(0, 4).map(ex => {
            const title = (ex.title || 'Exam');
            const dt = ex.exam_date ? new Date(ex.exam_date).toLocaleDateString() : 'Scheduled';
            const cls = (ex.classrooms && ex.classrooms.name) || 'Class';
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border:1px solid var(--gray-200); border-radius:var(--radius-md); background:#fff; margin-bottom:8px;">
                <div>
                  <strong style="color:var(--gray-900); font-size:0.875rem;">${title}</strong>
                  <div style="font-size:0.75rem; color:var(--gray-500);">${cls} • Date: ${dt}</div>
                </div>
                <a href="exams.html" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 10px;">Details</a>
              </div>
            `;
          }).join('');
        }
      }

      // Render real classrooms card
      const classroomsCard = document.querySelector('.grid-2:nth-of-type(2) > div:first-child > div:last-of-type, .dash-content > .grid-2:last-of-type > div:first-child > div:last-of-type');
      if (classroomsCard) {
        if (!classrooms || classrooms.length === 0) {
          classroomsCard.innerHTML = `
            <div style="text-align:center; padding:28px 16px; border:1.5px dashed var(--gray-200); border-radius:var(--radius-lg);">
              <div style="font-size:2rem; margin-bottom:8px;">🏫</div>
              <h5 style="margin-bottom:4px; color:var(--gray-800);">No active classrooms</h5>
              <p style="font-size:0.8rem; color:var(--gray-500); margin-bottom:12px;">Create your first class to generate a Class Code.</p>
              <a href="classrooms.html" class="btn btn-primary btn-sm">+ Create Classroom</a>
            </div>
          `;
        } else {
          classroomsCard.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${classrooms.slice(0, 3).map(c => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border:1px solid var(--gray-200); border-radius:var(--radius-md); background:#fff;">
                  <div>
                    <strong style="color:var(--gray-900); font-size:0.875rem;">${c.name}</strong>
                    <div style="font-size:0.75rem; color:var(--gray-500);">${c.subject || 'Academic'} • Code: <code>${c.class_code}</code></div>
                  </div>
                  <a href="students.html?class=${c.class_code}" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 10px;">Students</a>
                </div>
              `).join('')}
              <a href="classrooms.html" class="btn btn-primary btn-sm btn-full" style="margin-top:4px;">Manage All Classrooms (${classrooms.length})</a>
            </div>
          `;
        }
      }

      // Clear demo notifications
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

      // Super Admin Panel (SEC-04: dynamic email)
      if (isAdmin && !document.getElementById('admin-super-panel')) {
        const content = document.querySelector('.dash-content');
        if (content) {
          const userObj = this.getCurrentUser();
          const profObj = this.getActiveProfile();
          const adminEmail = (profObj && profObj.email) || (userObj && userObj.email) || 'Administrator';
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
                  Logged in as Platform Administrator (<strong>${adminEmail}</strong>). Strict privacy isolation active: students and teachers cannot see confidential data belonging to others.
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
    // 2. TEACHER SCHEDULE / CALENDAR (teacher/schedule.html, student/schedule.html) (Bug 23)
    // ───────────────────────────────────────────
    if (path.includes('/teacher/schedule.html') || path.includes('/student/schedule.html')) {
      const isStudent = path.includes('/student/');
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
          if (isStudent) {
            note.innerHTML = `📅 <strong>Your weekly timetable is clear.</strong> No scheduled live sessions or lectures for this week yet.`;
          } else {
            note.innerHTML = `📅 <strong>Your official weekly timetable is clear.</strong> Click <strong>"➕ Schedule Session"</strong> above to schedule live classes or events.`;
          }
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
        const s0 = stats[0].querySelector('div > div:first-child');
        const s1 = stats[1].querySelector('div > div:first-child');
        const s2 = stats[2].querySelector('div > div:first-child');
        if (s0) s0.textContent = '0';
        if (s1) s1.textContent = '0';
        if (s2) s2.textContent = '0';
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
      const students = await this.fetchStudentsForTeacher();
      const classrooms = await this.fetchClassrooms();
      const filter = document.getElementById('class-filter');
      if (filter && classrooms.length > 0) {
        filter.innerHTML = '<option value="all">All Classrooms (' + students.length + ')</option>' +
          classrooms.map(c => `<option value="${c.name}">${c.name} (${c.class_code})</option>`).join('');
      }
      const tbody = document.querySelector('#students-table tbody');
      if (tbody) {
        if (!students.length) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" style="text-align:center; padding:56px 20px;">
                <div style="font-size:2.5rem; margin-bottom:8px;">👥</div>
                <h4 style="color:var(--gray-800); margin-bottom:4px;">No Students Enrolled Yet</h4>
                <p style="font-size:0.875rem; color:var(--gray-500); margin-bottom:16px;">Share your Classora ID (<strong>${cid}</strong>) or Class Codes with students so they can join your classrooms.</p>
                <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${cid}', 'Classora ID Copied!')">📋 Copy Your ID (${cid})</button>
              </td>
            </tr>
          `;
        } else {
          tbody.innerHTML = students.map(s => {
            const p = s.profiles || {};
            const c = s.classrooms || {};
            const name = p.full_name || 'Student';
            const studentCid = p.classora_id || s.student_id;
            const clsName = c.name || 'Classroom';
            const initials = name.charAt(0).toUpperCase();
            return `
              <tr data-class="${clsName}" data-search="${name.toLowerCase()} ${studentCid.toLowerCase()}">
                <td>
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div class="user-avatar avatar-sm" style="background:var(--grad-primary); color:#fff; font-weight:700;">${initials}</div>
                    <div>
                      <strong style="color:var(--gray-900);">${name}</strong>
                      <div style="font-size:0.75rem; color:var(--gray-500);">${p.email || ''}</div>
                    </div>
                  </div>
                </td>
                <td><code>${studentCid}</code></td>
                <td><span class="badge badge-primary">${clsName}</span></td>
                <td><strong style="color:var(--gray-600);">--</strong></td>
                <td><strong style="color:var(--accent-600);">--</strong></td>
                <td><span class="badge badge-success">Active</span></td>
                <td style="text-align:right;">
                  <button class="btn btn-ghost btn-sm" onclick="viewStudentModal('${name.replace("'", "\\'")}', '${studentCid}', '${clsName}', 'Active', '--')">Inspect</button>
                </td>
              </tr>
            `;
          }).join('');
        }
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
                <div style="display:flex; gap:8px; margin-top:auto; padding-top:12px; align-items:center;">
                  <a href="students.html?class=${c.class_code}" class="btn btn-secondary btn-sm" style="flex:1;">View Students</a>
                  <button class="btn btn-ghost btn-sm" onclick="copyToClipboard('${c.class_code}', 'Class Code Copied!')" title="Copy Class Code">📋 Code</button>
                  <button class="btn btn-ghost btn-sm" onclick="confirmDeleteClassroom('${c.id || c.class_code}', '${(c.name || 'Classroom').replace(/'/g, "\\'")}')" title="Delete Classroom" style="color:var(--danger-600); border-color:rgba(220,38,38,0.25);">🗑️ Delete</button>
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
      const list = document.getElementById('notif-list');
      if (list) {
        list.innerHTML = `
          <div style="text-align:center; padding:56px 20px; background:#fff; border-radius:var(--radius-lg); border:1px solid var(--gray-200);">
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
      const classrooms = isAdmin ? await this.fetchClassrooms() : await this.fetchEnrolledClassrooms();
      const assignments = await this.fetchAssignments();
      const exams = await this.fetchExams();

      const statsGrid = document.querySelector('.stats-grid');
      if (statsGrid) {
        const stats = statsGrid.querySelectorAll('.card-stat');
        if (stats.length >= 4) {
          const s0_1 = stats[0].querySelector('div > div:first-child');
          const s0_2 = stats[0].querySelector('div > div:nth-child(2)');
          if (s0_1) s0_1.textContent = classrooms.length;
          if (s0_2) s0_2.textContent = 'Enrolled Classes';

          const s1_1 = stats[1].querySelector('div > div:first-child');
          const s1_2 = stats[1].querySelector('div > div:nth-child(2)');
          if (s1_1) s1_1.textContent = assignments.length;
          if (s1_2) s1_2.textContent = 'Homework Due';

          const s2_1 = stats[2].querySelector('div > div:first-child');
          const s2_2 = stats[2].querySelector('div > div:nth-child(2)');
          if (s2_1) s2_1.textContent = exams.length;
          if (s2_2) s2_2.textContent = 'Upcoming Exams';

          const s3_1 = stats[3].querySelector('div > div:first-child');
          const s3_2 = stats[3].querySelector('div > div:nth-child(2)');
          if (s3_1) s3_1.textContent = '100%';
          if (s3_2) s3_2.textContent = 'Attendance Rate';
        }
      }

      const classesCard = document.querySelector('.grid-2 > div:first-child > div:last-child');
      if (classesCard) {
        if (classrooms.length > 0) {
          classesCard.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${classrooms.slice(0, 3).map(c => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border:1px solid var(--gray-200); border-radius:var(--radius-md); background:#fff;">
                  <div>
                    <strong style="color:var(--gray-900); font-size:0.9rem;">${(window.escapeHTML ? window.escapeHTML(c.name) : c.name)}</strong>
                    <div style="font-size:0.75rem; color:var(--gray-500);">${(window.escapeHTML ? window.escapeHTML(c.subject || 'Academic') : (c.subject || 'Academic'))} • Code: <code>${c.class_code}</code></div>
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
        if (exams && exams.length > 0) {
          examCard.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${exams.slice(0, 3).map(ex => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border:1px solid var(--gray-200); border-radius:var(--radius-md); background:#fff;">
                  <div>
                    <strong style="color:var(--gray-900); font-size:0.85rem;">${(window.escapeHTML ? window.escapeHTML(ex.title) : ex.title)}</strong>
                    <div style="font-size:0.75rem; color:var(--gray-500);">${ex.classrooms ? (window.escapeHTML ? window.escapeHTML(ex.classrooms.name) : ex.classrooms.name) : 'Class'} • ${ex.exam_date ? new Date(ex.exam_date).toLocaleDateString() : 'Scheduled'}</div>
                  </div>
                  <a href="exams.html" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:3px 8px;">View</a>
                </div>
              `).join('')}
            </div>
          `;
        } else {
          examCard.innerHTML = `
            <div style="text-align:center; padding:24px 16px; border:1.5px dashed var(--gray-200); border-radius:var(--radius-lg);">
              <p style="font-size:0.85rem; color:var(--gray-500); margin:0;">No upcoming exams scheduled.</p>
            </div>
          `;
        }
      }
    }

    if (path.includes('/student/classrooms.html') && isAdmin) {
      const grid = document.querySelector('.dash-content .grid') || document.getElementById('classrooms-container');
      if (grid) {
        const classrooms = await this.fetchClassrooms();
        if (classrooms.length > 0) {
          grid.innerHTML = '';
          classrooms.forEach(c => {
            const card = document.createElement('div');
            card.className = 'class-card';
            const escName = window.escapeHTML ? window.escapeHTML(c.name) : c.name;
            const escSub = window.escapeHTML ? window.escapeHTML(c.subject || 'Academic') : (c.subject || 'Academic');
            const escSec = window.escapeHTML ? window.escapeHTML(c.section || 'General') : (c.section || 'General');
            const escCode = window.escapeHTML ? window.escapeHTML(c.class_code) : c.class_code;
            const escDesc = window.escapeHTML ? window.escapeHTML(c.description || 'Active classroom') : (c.description || 'Active classroom');
            card.innerHTML = `
              <div class="class-card-header card-grad-1">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <span class="badge" style="background:rgba(255,255,255,0.25); color:#fff;">👑 Admin Student View</span>
                  <span class="badge" style="background:rgba(255,255,255,0.25); color:#fff;">Code: ${escCode}</span>
                </div>
                <h3 style="color:#fff; margin-top:12px; margin-bottom:4px;">${escName}</h3>
                <div style="font-size:0.85rem; opacity:0.85;">${escSub} • ${escSec}</div>
              </div>
              <div class="class-card-body">
                <div class="class-meta-row">
                  <span>👑 Privilege</span>
                  <strong style="color:var(--primary-700);">Super Admin Dual Access</strong>
                </div>
                <div class="class-meta-row">
                  <span>📝 Description</span>
                  <strong style="color:var(--gray-900);">${escDesc}</strong>
                </div>
                <div style="display:flex; gap:8px; margin-top:auto; padding-top:12px;">
                  <a href="homework.html?class=${escCode}" class="btn btn-primary btn-sm" style="flex:1;">🎒 View Homework</a>
                  <a href="exams.html?class=${escCode}" class="btn btn-secondary btn-sm" style="flex:1;">📝 Take Exams</a>
                </div>
              </div>
            `;
            grid.appendChild(card);
          });
        }
      }
    }

    if (path.includes('/student/homework.html')) {
      const assignments = await this.fetchAssignments();
      if (!assignments || assignments.length === 0) {
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
    }

    if (path.includes('/student/exams.html')) {
      const exams = await this.fetchExams();
      if (!exams || exams.length === 0) {
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
    }

    if (path.includes('/student/teachers.html')) {
      const enrolled = await this.fetchEnrolledClassrooms();
      const grid = document.querySelector('.dash-content .grid');
      if (grid) {
        const teachersMap = new Map();
        enrolled.forEach(c => {
          if (c.profiles) {
            teachersMap.set(c.profiles.id || c.teacher_id, {
              teacher: c.profiles,
              classroom: c
            });
          }
        });
        if (teachersMap.size === 0) {
          grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:56px 20px; border:2px dashed var(--gray-200); border-radius:var(--radius-xl); background:var(--gray-50);">
              <div style="font-size:2.5rem; margin-bottom:8px;">🧑‍🏫</div>
              <h4 style="color:var(--gray-800); margin-bottom:4px;">No Connected Teachers</h4>
              <p style="font-size:0.875rem; color:var(--gray-500); margin-bottom:16px;">Teachers will appear here once you enroll in their classes.</p>
              <a href="classrooms.html" class="btn btn-primary btn-sm">➕ Join a Classroom</a>
            </div>
          `;
        } else {
          grid.innerHTML = Array.from(teachersMap.values()).map(({ teacher, classroom }) => {
            const tName = window.escapeHTML ? window.escapeHTML(teacher.full_name || 'Classora Educator') : (teacher.full_name || 'Classora Educator');
            const tSub = window.escapeHTML ? window.escapeHTML(teacher.subject || classroom.subject || 'Educator') : (teacher.subject || classroom.subject || 'Educator');
            const tCid = window.escapeHTML ? window.escapeHTML(teacher.classora_id || 'TCH') : (teacher.classora_id || 'TCH');
            const cName = window.escapeHTML ? window.escapeHTML(classroom.name) : classroom.name;
            const initials = tName.charAt(0).toUpperCase();
            return `
              <div class="card animate-fade-up" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                  <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
                    <div class="user-avatar avatar-lg" style="background:var(--grad-primary); color:#fff; font-weight:700; font-size:1.25rem;">
                      ${teacher.avatar_url ? `<img src="${teacher.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>` : initials}
                    </div>
                    <div>
                      <h4 style="margin:0 0 2px; color:var(--gray-900); font-size:1.05rem;">${tName}</h4>
                      <div style="font-size:0.8rem; color:var(--primary-600); font-weight:600;">${tSub}</div>
                      <div style="font-size:0.75rem; color:var(--gray-400); margin-top:2px;">ID: <code>${tCid}</code></div>
                    </div>
                  </div>
                  <div style="background:var(--gray-50); border:1px solid var(--gray-200); border-radius:var(--radius-md); padding:10px 12px; margin-bottom:14px; font-size:0.85rem;">
                    <div style="color:var(--gray-500); font-size:0.75rem;">Your Enrolled Class:</div>
                    <strong style="color:var(--gray-900);">${cName}</strong>
                  </div>
                </div>
                <div style="border-top:1px solid var(--gray-100); padding-top:12px; display:flex; gap:10px;">
                  <button class="btn btn-primary btn-sm flex-1" onclick="openModal('modal-contact-teacher')">💬 Message Educator</button>
                  <a href="classrooms.html" class="btn btn-secondary btn-sm">Classroom</a>
                </div>
              </div>
            `;
          }).join('');
        }
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

  // ─── ASSIGNMENTS (Homework) ────────────────────────────────────────────────

  async fetchAssignments({ classroomId = null } = {}) {
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    const user = this.getCurrentUser();
    if (!user) return [];
    try {
      let url = `${this.url}/rest/v1/assignments?select=*,classrooms(name,class_code)&order=created_at.desc`;
      if (classroomId) url += `&classroom_id=eq.${classroomId}`;
      const resp = await fetch(url, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) return await resp.json();
      return [];
    } catch (e) { console.warn('fetchAssignments error:', e); return []; }
  }

  async createAssignment({ title, description, classroom_id, due_date, total_points = 20 }) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Not signed in');
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    const payload = { title, description, classroom_id, due_date, total_points, max_marks: total_points, teacher_id: user.id };
    const resp = await fetch(`${this.url}/rest/v1/assignments`, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey, 'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) { const e = await resp.json(); throw new Error(e.message || 'Failed to create assignment'); }
    const saved = await resp.json();
    return saved[0] || payload;
  }

  async deleteAssignment(id) {
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    await fetch(`${this.url}/rest/v1/assignments?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
    });
  }

  // --- Assignment Submissions ---
  async fetchSubmissions({ assignmentId = null, studentId = null } = {}) {
    try {
      const user = this.getCurrentUser();
      if (!user) return [];
      const session = this.getLocalSession();
      const token = session ? session.access_token : this.anonKey;
      let url = `${this.url}/rest/v1/submissions?select=*`;
      if (assignmentId) url += `&assignment_id=eq.${assignmentId}`;
      if (studentId) url += `&student_id=eq.${studentId}`;
      else if (!this.isAdmin() && user.role !== 'teacher') url += `&student_id=eq.${user.id}`;
      
      const resp = await fetch(url, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) return await resp.json();
      return [];
    } catch(e) {
      console.warn('fetchSubmissions error:', e);
      return [];
    }
  }

  async submitAssignment({ assignment_id, notes = '', file = null }) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('You must be signed in to submit assignments.');
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;

    let fileUrl = null;
    if (file) {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `submissions/${user.id}/${Date.now()}_${cleanName}`;
      const uploadResp = await fetch(`${this.url}/storage/v1/object/documents/${filePath}`, {
        method: 'POST',
        headers: {
          'apikey': this.anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });
      if (uploadResp.ok) {
        fileUrl = `${this.url}/storage/v1/object/public/documents/${filePath}`;
      }
    }

    const payload = {
      assignment_id,
      student_id: user.id,
      notes,
      file_url: fileUrl,
      status: 'submitted',
      submitted_at: new Date().toISOString()
    };

    const resp = await fetch(`${this.url}/rest/v1/submissions`, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.message || 'Failed to submit assignment');
    }
    const saved = await resp.json();
    return saved[0] || payload;
  }

  // ─── EXAMS ────────────────────────────────────────────────────────────────

  async fetchExams({ classroomId = null } = {}) {
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    const user = this.getCurrentUser();
    if (!user) return [];
    try {
      let url = `${this.url}/rest/v1/exams?select=*,classrooms(name,class_code)&order=exam_date.asc`;
      if (classroomId) url += `&classroom_id=eq.${classroomId}`;
      const resp = await fetch(url, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) return await resp.json();
      return [];
    } catch (e) { console.warn('fetchExams error:', e); return []; }
  }

  async createExam({ title, classroom_id, exam_date, duration_minutes = 60, total_marks = 100, passing_marks = 40 }) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Not signed in');
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    const payload = { title, classroom_id, exam_date, duration_minutes, duration_mins: duration_minutes, total_marks, passing_marks, teacher_id: user.id, status: 'upcoming' };
    const resp = await fetch(`${this.url}/rest/v1/exams`, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey, 'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) { const e = await resp.json(); throw new Error(e.message || 'Failed to create exam'); }
    const saved = await resp.json();
    return saved[0] || payload;
  }

  async deleteExam(id) {
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    await fetch(`${this.url}/rest/v1/exams?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
    });
  }

  // ─── EXAM RESULTS ──────────────────────────────────────────────────────────

  async fetchExamResults({ studentId = null, examId = null } = {}) {
    const user = this.getCurrentUser();
    if (!user) return [];
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    try {
      let url = `${this.url}/rest/v1/exam_results?select=*,exams(id,title,subject,total_marks,profiles(full_name))&order=created_at.desc`;
      if (studentId) url += `&student_id=eq.${studentId}`;
      else if (examId) url += `&exam_id=eq.${examId}`;
      const resp = await fetch(url, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) return await resp.json();
      return [];
    } catch (e) {
      console.warn('fetchExamResults error:', e);
      return [];
    }
  }

  async publishExamResult({ exam_id, student_id, marks_obtained, grade = null, remarks = '' }) {
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    const payload = {
      exam_id,
      student_id,
      marks_obtained,
      grade,
      remarks
    };
    const resp = await fetch(`${this.url}/rest/v1/exam_results`, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey, 'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(e.message || 'Failed to publish exam result');
    }
    return (await resp.json())[0] || payload;
  }

  // ─── JOIN REQUESTS ────────────────────────────────────────────────────────

  async fetchJoinRequests({ status = 'pending' } = {}) {
    const user = this.getCurrentUser();
    if (!user) return [];
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    try {
      // Fetch requests for classrooms owned by this teacher
      const url = `${this.url}/rest/v1/join_requests?select=*,classrooms(name,class_code,teacher_id),profiles!join_requests_student_id_fkey(full_name,email,classora_id)&status=eq.${status}&order=created_at.desc`;
      const resp = await fetch(url, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const all = await resp.json();
        // Filter to only this teacher's classrooms
        return all.filter(r => r.classrooms && r.classrooms.teacher_id === user.id);
      }
      return [];
    } catch (e) { console.warn('fetchJoinRequests error:', e); return []; }
  }

  async submitJoinRequest({ classroomCode }) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Not signed in');
    // Ensure student's profile exists in DB before sending foreign-keyed join request
    await this.fetchAndStoreProfile(user.id, { email: user.email, role: 'student' });
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    // Find classroom by code
    const clsResp = await fetch(`${this.url}/rest/v1/classrooms?class_code=eq.${classroomCode}&select=id,name,teacher_id`, {
      headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
    });
    if (!clsResp.ok) throw new Error('Classroom not found');
    const clsList = await clsResp.json();
    if (!clsList.length) throw new Error('Invalid classroom code. Please check with your teacher.');
    const classroom = clsList[0];

    // Check if student is already enrolled in this classroom (Bug 5)
    try {
      const memberCheck = await fetch(`${this.url}/rest/v1/classroom_members?student_id=eq.${user.id}&classroom_id=eq.${classroom.id}&select=id`, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (memberCheck.ok) {
        const memberRows = await memberCheck.json();
        if (memberRows.length > 0) throw new Error('You are already enrolled in this classroom.');
      }
    } catch (memErr) {
      if (memErr.message && memErr.message.includes('enrolled')) throw memErr;
    }

    // Check if student already has a pending join request (Bug 5)
    try {
      const existingReq = await fetch(`${this.url}/rest/v1/join_requests?student_id=eq.${user.id}&classroom_id=eq.${classroom.id}&status=eq.pending&select=id`, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (existingReq.ok) {
        const reqRows = await existingReq.json();
        if (reqRows.length > 0) throw new Error('You already requested to join this class.');
      }
    } catch (reqErr) {
      if (reqErr.message && reqErr.message.includes('already requested')) throw reqErr;
    }

    const payload = {
      student_id: user.id,
      classroom_id: classroom.id,
      teacher_id: classroom.teacher_id,
      status: 'pending'
    };
    const resp = await fetch(`${this.url}/rest/v1/join_requests`, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey, 'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const e = await resp.json();
      if (e.code === '23505') throw new Error('You have already sent a request to join this classroom.');
      throw new Error(e.message || 'Failed to send join request');
    }
    return (await resp.json())[0] || payload;
  }

  async approveJoinRequest(requestId) {
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    // Get the request details first
    const reqResp = await fetch(`${this.url}/rest/v1/join_requests?id=eq.${requestId}&select=*`, {
      headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
    });
    const reqs = await reqResp.json();
    if (!reqs.length) throw new Error('Request not found');
    const req = reqs[0];
    // Update status to approved
    await fetch(`${this.url}/rest/v1/join_requests?id=eq.${requestId}`, {
      method: 'PATCH',
      headers: {
        'apikey': this.anonKey, 'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'approved' })
    });
    // Enroll student in classroom_members
    const enrollResp = await fetch(`${this.url}/rest/v1/classroom_members`, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey, 'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ classroom_id: req.classroom_id, student_id: req.student_id })
    });
    if (!enrollResp.ok) {
      const errBody = await enrollResp.json().catch(() => ({}));
      console.warn('Enrolment insert response warning:', errBody);
    }
    return { success: true };
  }

  async rejectJoinRequest(requestId) {
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    await fetch(`${this.url}/rest/v1/join_requests?id=eq.${requestId}`, {
      method: 'PATCH',
      headers: {
        'apikey': this.anonKey, 'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'rejected' })
    });
    return { success: true };
  }

  // ─── STUDENTS (enrolled) ──────────────────────────────────────────────────

  async fetchStudentsForTeacher() {
    const user = this.getCurrentUser();
    if (!user) return [];
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    try {
      const url = `${this.url}/rest/v1/classroom_members?select=*,classrooms(name,class_code,teacher_id),profiles(full_name,email,classora_id,grade)&classrooms.teacher_id=eq.${user.id}`;
      const resp = await fetch(url, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const all = await resp.json();
        return all.filter(m => m.classrooms && m.classrooms.teacher_id === user.id);
      }
      return [];
    } catch (e) { console.warn('fetchStudentsForTeacher error:', e); return []; }
  }

  async fetchEnrolledClassrooms() {
    const user = this.getCurrentUser();
    if (!user) return [];
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    try {
      const url = `${this.url}/rest/v1/classroom_members?student_id=eq.${user.id}&select=*,classrooms(*,profiles:teacher_id(id,full_name,email,classora_id,subject,avatar_url))`;
      const resp = await fetch(url, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const list = await resp.json();
        return list.map(m => m.classrooms).filter(Boolean);
      }
      return [];
    } catch (e) { return []; }
  }

  // ─── DIRECTORY SEARCH ────────────────────────────────────────────────────

  async searchDirectory(query = '') {
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    try {
      let url = `${this.url}/rest/v1/profiles?select=id,full_name,email,phone,role,classora_id,subject,grade,avatar_url,institute,bio,privacy_settings&full_name=not.is.null&order=full_name.asc`;
      if (query.trim()) {
        const q = encodeURIComponent(query.trim());
        url += `&or=(full_name.ilike.*${q}*,classora_id.ilike.*${q}*,email.ilike.*${q}*)`;
      }
      let results = [];
      const resp = await fetch(url, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) results = await resp.json();

      // Merge active user profile if matches query (for instant demo / local testing)
      const local = this.getActiveProfile();
      if (local && !results.some(r => r.id === local.id || r.classora_id === local.classora_id)) {
        const qClean = query.trim().toLowerCase();
        const matchName = (local.full_name || '').toLowerCase().includes(qClean);
        const matchCid = (local.classora_id || '').toLowerCase().includes(qClean);
        if (!qClean || matchName || matchCid) {
          results.unshift(local);
        }
      }

      return results;
    } catch (e) {
      console.warn('searchDirectory error:', e);
      const local = this.getActiveProfile();
      return local ? [local] : [];
    }
  }

  // ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────

  async fetchAnnouncements({ classroomId = null } = {}) {
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    try {
      let url = `${this.url}/rest/v1/announcements?select=*,profiles(full_name)&order=created_at.desc`;
      if (classroomId) url += `&classroom_id=eq.${classroomId}`;
      const resp = await fetch(url, {
        headers: { 'apikey': this.anonKey, 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) return await resp.json();
      return [];
    } catch (e) { return []; }
  }

  async createAnnouncement({ title, body, classroom_id = null }) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Not signed in');
    const session = this.getLocalSession();
    const token = session ? session.access_token : this.anonKey;
    const payload = { title, body, classroom_id, author_id: user.id };
    const resp = await fetch(`${this.url}/rest/v1/announcements`, {
      method: 'POST',
      headers: {
        'apikey': this.anonKey, 'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) { const e = await resp.json(); throw new Error(e.message || 'Failed to post announcement'); }
    return (await resp.json())[0] || payload;
  }

  // ─── SUPABASE REALTIME SUBSCRIPTIONS ─────────────────────────────────────

  subscribeToTable(table, callback, filter = null) {
    return this.realtime.registerChannel({
      key: `rt-${table}-compat`,
      table: table,
      filter: filter,
      onAny: callback
    });
  }

  unsubscribe(channel) {
    if (typeof channel === 'string') {
      this.realtime.removeChannel(channel);
    } else if (channel && channel.topic) {
      if (this.client) {
        try { this.client.removeChannel(channel); } catch (e) {}
      }
    }
  }
}

// ─── PRODUCTION REALTIME SYNCHRONIZATION MANAGER ─────────────────────────────
class ClassoraRealtimeManager {
  constructor(authService) {
    this.auth = authService;
    this.channels = new Map();
    this.reconnectHandlers = new Map();
    this.statusListeners = new Set();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[Classora Realtime] Network restored (online). Triggering reconciliation...');
        this.reconcileAll();
      });
    }
  }

  getClient() {
    return this.auth.client;
  }

  onStatusChange(fn) {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  _notifyStatus(channelKey, status, err = null) {
    this.statusListeners.forEach(fn => {
      try { fn({ channelKey, status, error: err }); } catch (e) {}
    });
  }

  getChannel(key) {
    return this.channels.get(key) || null;
  }

  reconcileAll() {
    this.reconnectHandlers.forEach((handler, key) => {
      try {
        if (typeof handler === 'function') {
          console.log(`[Classora Realtime] Reconciling channel data: ${key}`);
          handler();
        }
      } catch (e) {
        console.warn('[Classora Realtime] Reconcile error for ' + key, e);
      }
    });
  }

  /**
   * Safely registers or replaces a targeted Realtime channel
   */
  registerChannel({ key, table, filter = null, onInsert, onUpdate, onDelete, onAny, onReconnect, onError }) {
    const client = this.getClient();
    if (!client) {
      console.warn('[Classora Realtime] Client not initialized. Cannot subscribe to:', key);
      return null;
    }

    // Remove existing channel with the same key to prevent leaks and duplicate listeners
    this.removeChannel(key);

    if (typeof onReconnect === 'function') {
      this.reconnectHandlers.set(key, onReconnect);
    }

    try {
      let channel = client.channel(key);
      const opts = { event: '*', schema: 'public', table };
      if (filter) opts.filter = filter;

      channel = channel.on('postgres_changes', opts, payload => {
        const eventType = payload.eventType;
        if (typeof onAny === 'function') onAny(payload);
        if (eventType === 'INSERT' && typeof onInsert === 'function') onInsert(payload.new, payload);
        else if (eventType === 'UPDATE' && typeof onUpdate === 'function') onUpdate(payload.new, payload.old, payload);
        else if (eventType === 'DELETE' && typeof onDelete === 'function') onDelete(payload.old, payload);
      });

      let hasSubscribedBefore = false;

      channel.subscribe((status, err) => {
        this._notifyStatus(key, status, err);
        if (status === 'SUBSCRIBED') {
          console.log(`[Classora Realtime] Subscribed to ${key} (${table})`);
          if (hasSubscribedBefore && typeof onReconnect === 'function') {
            console.log(`[Classora Realtime] Reconnected: ${key}. Reconciling data...`);
            try { onReconnect(); } catch (recErr) { console.warn('Reconnect reconcile error:', recErr); }
          }
          hasSubscribedBefore = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[Classora Realtime] Status: ${status} for channel ${key}`, err);
          if (typeof onError === 'function') onError(status, err);
        }
      });

      this.channels.set(key, channel);
      return channel;
    } catch (e) {
      console.warn('[Classora Realtime] Subscription creation failed:', e);
      return null;
    }
  }

  removeChannel(key) {
    const channel = this.channels.get(key);
    if (channel) {
      const client = this.getClient();
      if (client) {
        try { client.removeChannel(channel); } catch (e) {}
      }
      this.channels.delete(key);
      this.reconnectHandlers.delete(key);
      console.log(`[Classora Realtime] Removed channel: ${key}`);
    }
  }

  unsubscribeAll() {
    const client = this.getClient();
    this.channels.forEach((channel, key) => {
      if (client) {
        try { client.removeChannel(channel); } catch (e) {}
      }
      console.log(`[Classora Realtime] Cleared channel: ${key}`);
    });
    this.channels.clear();
    this.reconnectHandlers.clear();
  }

  // --- Targeted Convenience Helpers ---

  subscribeToJoinRequests({ teacherId = null, studentId = null, onInsert, onUpdate, onDelete, onReconnect }) {
    let filter = null;
    let key = 'cr-join-reqs';
    if (teacherId) {
      filter = `teacher_id=eq.${teacherId}`;
      key = `cr-join-reqs-t-${teacherId}`;
    } else if (studentId) {
      filter = `student_id=eq.${studentId}`;
      key = `cr-join-reqs-s-${studentId}`;
    }
    return this.registerChannel({
      key,
      table: 'join_requests',
      filter,
      onInsert,
      onUpdate,
      onDelete,
      onReconnect
    });
  }

  subscribeToClassroomMembers({ studentId = null, classroomId = null, onInsert, onDelete, onReconnect }) {
    let filter = null;
    let key = 'cr-members';
    if (studentId) {
      filter = `student_id=eq.${studentId}`;
      key = `cr-members-s-${studentId}`;
    } else if (classroomId) {
      filter = `classroom_id=eq.${classroomId}`;
      key = `cr-members-c-${classroomId}`;
    }
    return this.registerChannel({
      key,
      table: 'classroom_members',
      filter,
      onInsert,
      onDelete,
      onReconnect
    });
  }

  subscribeToAssignments({ classroomId = null, onInsert, onUpdate, onDelete, onReconnect }) {
    const filter = classroomId ? `classroom_id=eq.${classroomId}` : null;
    const key = classroomId ? `cr-hw-c-${classroomId}` : 'cr-hw-all';
    return this.registerChannel({
      key,
      table: 'assignments',
      filter,
      onInsert,
      onUpdate,
      onDelete,
      onReconnect
    });
  }

  subscribeToSubmissions({ assignmentId = null, studentId = null, onInsert, onUpdate, onReconnect }) {
    let filter = null;
    let key = 'cr-subs';
    if (assignmentId) {
      filter = `assignment_id=eq.${assignmentId}`;
      key = `cr-subs-a-${assignmentId}`;
    } else if (studentId) {
      filter = `student_id=eq.${studentId}`;
      key = `cr-subs-s-${studentId}`;
    }
    return this.registerChannel({
      key,
      table: 'submissions',
      filter,
      onInsert,
      onUpdate,
      onReconnect
    });
  }

  subscribeToExams({ classroomId = null, onInsert, onUpdate, onDelete, onReconnect }) {
    const filter = classroomId ? `classroom_id=eq.${classroomId}` : null;
    const key = classroomId ? `cr-exams-c-${classroomId}` : 'cr-exams-all';
    return this.registerChannel({
      key,
      table: 'exams',
      filter,
      onInsert,
      onUpdate,
      onDelete,
      onReconnect
    });
  }

  subscribeToResults({ studentId = null, onInsert, onUpdate, onReconnect }) {
    const filter = studentId ? `student_id=eq.${studentId}` : null;
    const key = studentId ? `cr-res-s-${studentId}` : 'cr-res-all';
    return this.registerChannel({
      key,
      table: 'exam_results',
      filter,
      onInsert,
      onUpdate,
      onReconnect
    });
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
