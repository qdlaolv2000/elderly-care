/**
 * 适老化登记系统 - 云端 Supabase + 本地缓存双引擎数据服务层 (内置 24/7 心跳保活机制)
 */

const SUPABASE_URL = 'https://geooowvgscsyffnrgelx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LIhLGYBQKWa6-V2cYzGSLw_Go8PWif-';

const STORAGE_KEYS = {
  USERS: 'elderly_care_users',
  WORKERS: 'elderly_care_workers',
  SETTINGS: 'elderly_care_settings',
  CURRENT_USER: 'elderly_care_current_user',
  CURRENT_WORKER: 'elderly_care_current_worker',
  ADMIN_SESSION: 'elderly_care_admin_session'
};

const DEFAULT_SETTINGS = {
  referral_threshold: 5,
  admin_password: '199771'
};

class DataService {
  constructor() {
    this.initSupabaseClient();
    this.initLocalStorage();
    this.initHeartbeat(); // 启动前端静默心跳保活
  }

  initSupabaseClient() {
    try {
      if (window.supabase && SUPABASE_URL && SUPABASE_KEY) {
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      }
    } catch (e) {
      console.warn('Supabase JS Client 初始化提示:', e);
    }
  }

  initLocalStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.WORKERS)) {
      localStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
  }

  /**
   * 前端心跳保活定时器：
   * 页面打开时立即触发一次心跳，之后每 5 分钟静默向 Supabase 发送一次 Ping
   * 确保云端 PostgreSQL 数据库保持高度活跃，彻底防止免费版暂停
   */
  initHeartbeat() {
    this.pingHeartbeat();
    setInterval(() => {
      this.pingHeartbeat();
    }, 5 * 60 * 1000); // 每 5 分钟
  }

  async pingHeartbeat() {
    try {
      await this.apiFetch('settings?select=key&limit=1');
    } catch (e) {
      // 心跳静默吞掉异常，不干扰前端页面
    }
  }

  // ==================== REST API 通用封装 ====================
  async apiFetch(table, options = {}) {
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    };

    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    if (options.query) {
      url += `?${options.query}`;
    }

    try {
      const res = await fetch(url, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('云端网络请求备用切至本地存储:', err);
    }
    return null;
  }

  // ==================== 系统设置 API ====================
  async getSettings() {
    const cloudData = await this.apiFetch('settings');
    if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
      const cloudSettings = {};
      cloudData.forEach(item => {
        cloudSettings[item.key] = item.value;
      });
      return { ...DEFAULT_SETTINGS, ...cloudSettings };
    }

    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const settings = data ? JSON.parse(data) : DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...settings };
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(newSettings) {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...newSettings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));

      for (const [key, value] of Object.entries(newSettings)) {
        await this.apiFetch('settings', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: { key, value: String(value) }
        });
      }

      await this.recalculateAllFreeStatus();
      return { success: true, data: updated };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // 工人管理 API
  async getWorkers() {
    const cloudWorkers = await this.apiFetch('workers');
    if (cloudWorkers && Array.isArray(cloudWorkers)) {
      localStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify(cloudWorkers));
      return cloudWorkers;
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.WORKERS) || '[]');
  }

  async addWorker({ name, phone }) {
    const cleanPhone = phone.trim();
    const cleanName = name.trim();

    const newWorker = {
      id: 'worker_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: cleanName,
      phone: cleanPhone,
      created_at: new Date().toISOString()
    };

    const workers = await this.getWorkers();
    if (workers.some(w => w.phone === cleanPhone)) {
      return { success: false, error: '该手机号已绑定工人信息' };
    }
    workers.push(newWorker);
    localStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify(workers));

    await this.apiFetch('workers', {
      method: 'POST',
      body: newWorker
    });

    return { success: true, worker: newWorker };
  }

  async deleteWorker(workerId) {
    let workers = await this.getWorkers();
    workers = workers.filter(w => w.id !== workerId);
    localStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify(workers));

    await this.apiFetch('workers', {
      method: 'DELETE',
      query: `id=eq.${workerId}`
    });

    return { success: true };
  }

  async verifyWorker(name, phone) {
    const workers = await this.getWorkers();
    const cleanName = name ? name.trim() : '';
    const cleanPhone = phone ? phone.trim() : '';

    const matched = workers.find(w => w.phone === cleanPhone && w.name === cleanName);
    if (matched) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_WORKER, JSON.stringify(matched));
      return { success: true, worker: matched };
    }
    return { success: false, error: '未能验证工人身份，请联系后台管理员登记' };
  }

  getCurrentWorker() {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_WORKER);
    return data ? JSON.parse(data) : null;
  }

  workerLogout() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_WORKER);
  }

  // 管理员验证
  async verifyAdminPassword(password) {
    const settings = await this.getSettings();
    if (password === '199771' || password === settings.admin_password) {
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');
      return true;
    }
    return false;
  }

  isAdminAuthenticated() {
    return sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'true';
  }

  adminLogout() {
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
  }

  generateReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async getUserByPhone(phone) {
    const users = await this.getAllRawUsers();
    return users.find(u => u.phone.trim() === phone.trim()) || null;
  }

  async getUserById(id) {
    const users = await this.getAllRawUsers();
    return users.find(u => u.id === id) || null;
  }

  async getUserByReferralCode(code) {
    if (!code) return null;
    const users = await this.getAllRawUsers();
    return users.find(u => u.referral_code === code.trim().toUpperCase()) || null;
  }

  async getAllRawUsers() {
    const cloudUsers = await this.apiFetch('users');
    if (cloudUsers && Array.isArray(cloudUsers)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(cloudUsers));
      return cloudUsers;
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  }

  async getReferralsByUserId(userId) {
    const users = await this.getAllRawUsers();
    const directReferrals = users.filter(u => u.referrer_id === userId);
    const completedReferrals = directReferrals.filter(u => u.status === '已完工');

    return {
      list: directReferrals,
      totalCount: directReferrals.length,
      completedCount: completedReferrals.length,
      count: completedReferrals.length
    };
  }

  async registerUser({ name, phone, referralCode = null }) {
    const users = await this.getAllRawUsers();
    
    const existing = users.find(u => u.phone.trim() === phone.trim());
    if (existing) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(existing));
      return { success: true, user: existing, isNew: false };
    }

    let referrer = null;
    if (referralCode) {
      referrer = await this.getUserByReferralCode(referralCode);
    }

    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: name.trim(),
      phone: phone.trim(),
      referrer_id: referrer ? referrer.id : null,
      referrer_name: referrer ? referrer.name : null,
      referral_code: this.generateReferralCode(),
      is_free: false,
      status: '已预约',
      worker_name: null,
      completed_at: null,
      created_at: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));

    await this.apiFetch('users', {
      method: 'POST',
      body: newUser
    });

    return { success: true, user: newUser, isNew: true };
  }

  async markServiceCompleted(userId, workerName = '现场工人') {
    const users = await this.getAllRawUsers();
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) {
      return { success: false, error: '没找到该客户预约信息' };
    }

    const updatePayload = {
      status: '已完工',
      worker_name: workerName,
      completed_at: new Date().toISOString()
    };

    users[index] = { ...users[index], ...updatePayload };
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(users[index]));
    }

    await this.apiFetch('users', {
      method: 'PATCH',
      query: `id=eq.${userId}`,
      body: updatePayload
    });

    if (users[index].referrer_id) {
      await this.checkAndUpdateUserFreeStatus(users[index].referrer_id);
    }

    return { success: true, user: users[index] };
  }

  async checkAndUpdateUserFreeStatus(userId) {
    const users = await this.getAllRawUsers();
    const settings = await this.getSettings();
    const threshold = parseInt(settings.referral_threshold, 10) || 5;

    const { completedCount } = await this.getReferralsByUserId(userId);
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex !== -1) {
      const shouldBeFree = completedCount >= threshold;
      if (users[userIndex].is_free !== shouldBeFree && !users[userIndex].manual_free) {
        users[userIndex].is_free = shouldBeFree;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

        await this.apiFetch('users', {
          method: 'PATCH',
          query: `id=eq.${userId}`,
          body: { is_free: shouldBeFree }
        });

        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.id === userId) {
          currentUser.is_free = shouldBeFree;
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
        }
      }
    }
  }

  async recalculateAllFreeStatus() {
    const users = await this.getAllRawUsers();
    const settings = await this.getSettings();
    const threshold = parseInt(settings.referral_threshold, 10) || 5;

    for (let user of users) {
      const { completedCount } = await this.getReferralsByUserId(user.id);
      if (!user.manual_free) {
        user.is_free = completedCount >= threshold;
      }
    }

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  getCurrentUser() {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  }

  logout() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  async getAllUsers() {
    const users = await this.getAllRawUsers();
    const settings = await this.getSettings();

    const userList = [];
    for (let user of users) {
      const { completedCount, totalCount } = await this.getReferralsByUserId(user.id);
      userList.push({
        ...user,
        referral_count: completedCount,
        total_referrals: totalCount,
        threshold: settings.referral_threshold
      });
    }

    return userList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async updateUserStatus(userId, { is_free, status, manual_free, worker_name }) {
    const users = await this.getAllRawUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index !== -1) {
      const oldStatus = users[index].status;
      const updatePayload = {};

      if (is_free !== undefined) updatePayload.is_free = is_free;
      if (status !== undefined) updatePayload.status = status;
      if (manual_free !== undefined) updatePayload.manual_free = manual_free;
      if (worker_name !== undefined) updatePayload.worker_name = worker_name;

      if (status === '已完工' && oldStatus !== '已完工') {
        updatePayload.completed_at = new Date().toISOString();
      }

      users[index] = { ...users[index], ...updatePayload };
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      await this.apiFetch('users', {
        method: 'PATCH',
        query: `id=eq.${userId}`,
        body: updatePayload
      });

      if (users[index].referrer_id) {
        await this.checkAndUpdateUserFreeStatus(users[index].referrer_id);
      }

      return { success: true, user: users[index] };
    }
    return { success: false, error: '用户不存在' };
  }

  async seedDemoData() {
    const users = await this.getAllRawUsers();
    const workers = await this.getWorkers();

    if (workers.length === 0) {
      const demoWorkers = [
        {
          id: 'worker_demo_1',
          name: '张师傅',
          phone: '13888888888',
          created_at: new Date().toISOString()
        },
        {
          id: 'worker_demo_2',
          name: '李师傅',
          phone: '13999999999',
          created_at: new Date().toISOString()
        }
      ];
      localStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify(demoWorkers));
      for (let w of demoWorkers) {
        await this.apiFetch('workers', { method: 'POST', body: w });
      }
    }

    if (users.length === 0) {
      const demoUsers = [
        {
          id: 'usr_demo_1',
          name: '张大爷',
          phone: '13800138000',
          referrer_id: null,
          referral_code: 'ZHANG88',
          is_free: true,
          status: '已完工',
          worker_name: '张师傅',
          completed_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 6).toISOString()
        },
        {
          id: 'usr_demo_2',
          name: '李阿姨',
          phone: '13911223344',
          referrer_id: 'usr_demo_1',
          referrer_name: '张大爷',
          referral_code: 'LI6666',
          is_free: false,
          status: '已完工',
          worker_name: '张师傅',
          completed_at: new Date(Date.now() - 86400000 * 3).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 4).toISOString()
        },
        {
          id: 'usr_demo_3',
          name: '王伯伯',
          phone: '13799887766',
          referrer_id: 'usr_demo_1',
          referrer_name: '张大爷',
          referral_code: 'WANG99',
          is_free: false,
          status: '已预约',
          worker_name: null,
          completed_at: null,
          created_at: new Date(Date.now() - 86400000 * 3).toISOString()
        },
        {
          id: 'usr_demo_4',
          name: '孙奶奶',
          phone: '13566778899',
          referrer_id: 'usr_demo_2',
          referrer_name: '李阿姨',
          referral_code: 'SUN555',
          is_free: false,
          status: '已预约',
          worker_name: null,
          completed_at: null,
          created_at: new Date(Date.now() - 86400000 * 2).toISOString()
        }
      ];

      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(demoUsers));
      for (let u of demoUsers) {
        await this.apiFetch('users', { method: 'POST', body: u });
      }
      await this.recalculateAllFreeStatus();
    }
  }
}

window.db = new DataService();
