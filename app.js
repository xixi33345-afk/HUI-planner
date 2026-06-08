'use strict';
// ===================== APP CONTROLLER =====================
// Manages two-level navigation, LeanCloud cloud sync, and profile page

// ===================== NAVIGATION CONFIG =====================
// 子导航图标：统一线性 SVG（继承 currentColor，激活态自动变主色）
const NAV_SVG = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const NAV_CONFIG = {
  health: {
    tabs: [
      { id:'dashboard', label:'仪表盘', icon:NAV_SVG('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>') },
      { id:'diet',      label:'饮食',   icon:NAV_SVG('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>') },
      { id:'weight',    label:'体重',   icon:NAV_SVG('<circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.9 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.9-2.54L19.4 9.5A2 2 0 0 0 17.5 8Z"/>') },
      { id:'exercise',  label:'运动',   icon:NAV_SVG('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>') }
    ]
  },
  planner: {
    tabs: [
      { id:'checkin',      label:'打卡',   icon:NAV_SVG('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>') },
      { id:'analytics',    label:'分析',   icon:NAV_SVG('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>') },
      { id:'achievements', label:'成就',   icon:NAV_SVG('<circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/>') }
    ]
  }
};

// Current navigation state
let currentMainTab = 'health';
let currentHealthSubTab = 'dashboard';
let currentPlannerSubTab = 'checkin';
let plannerInitialized = false;

// ===================== CLOUD SYNC =====================
// 后端为同域名的 Cloudflare Pages Functions（/api），邮箱+密码登录，KV 存储。
// 同源调用，无需配置；本地 file:// 打开时不可用（无 http 后端）。
const CloudSync = {
  configured: false,
  pushTimer: null,
  base: (typeof location !== 'undefined' ? location.origin : '') + '/api',
  available: (typeof location !== 'undefined') && /^https?:$/.test(location.protocol),

  init() {
    this.configured = this.available;
    if (!this.available) this.updateStatus('offline');
    return this.available;
  },

  token() { return localStorage.getItem('app_token'); },
  user() { return this.token() ? (localStorage.getItem('app_email') || '已登录') : null; },

  async _req(path, opts = {}) {
    const headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
    const t = this.token();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    const r = await fetch(this.base + path, Object.assign({}, opts, { headers }));
    let j = {};
    try { j = await r.json(); } catch {}
    if (!r.ok) { const err = new Error(j.error || ('请求失败 ' + r.status)); err.status = r.status; throw err; }
    return j;
  },

  async signup(email, password) {
    const j = await this._req('/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('app_token', j.token);
    localStorage.setItem('app_email', j.email);
  },

  async login(email, password) {
    const j = await this._req('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('app_token', j.token);
    localStorage.setItem('app_email', j.email);
  },

  async logout() {
    localStorage.removeItem('app_token');
    localStorage.removeItem('app_email');
    localStorage.removeItem('app_last_sync');
    localStorage.removeItem('app_sync_dirty');
    this.updateStatus('offline');
  },

  errMsg(e) { return (e && e.message) || '操作失败，请重试'; },

  updateStatus(state) {
    const dot = document.getElementById('syncStatus');
    const txt = document.getElementById('syncStatusText');
    if (!dot || !txt) return;
    dot.className = state;
    const labels = { online:'已同步', connecting:'连接中', offline:'未连接', syncing:'同步中', error:'同步失败' };
    txt.textContent = labels[state] || state;
  },

  _collect() {
    const planner = {
      activities: JSON.parse(localStorage.getItem('planner_activities') || '[]'),
      logs: JSON.parse(localStorage.getItem('planner_logs') || '{}'),
      notes: JSON.parse(localStorage.getItem('planner_notes') || '{}'),
      profile: JSON.parse(localStorage.getItem('planner_profile') || '{}')
    };
    const health = {};
    ['weight','diet','exercise','goals','profile'].forEach(k => {
      try { health[k] = JSON.parse(localStorage.getItem(`health_${k}`) || 'null'); } catch {}
    });
    let aiPlan = null;
    try { aiPlan = JSON.parse(localStorage.getItem('app_ai_plan') || 'null'); } catch {}
    return { planner, health, aiPlan, _t: Date.now() };
  },

  _apply(d) {
    if (!d) return;
    if (d.planner) {
      const p = d.planner;
      if (p.activities) localStorage.setItem('planner_activities', JSON.stringify(p.activities));
      if (p.logs) localStorage.setItem('planner_logs', JSON.stringify(p.logs));
      if (p.notes) localStorage.setItem('planner_notes', JSON.stringify(p.notes));
      if (p.profile) localStorage.setItem('planner_profile', JSON.stringify(p.profile));
    }
    if (d.health) {
      ['weight','diet','exercise','goals','profile'].forEach(k => {
        if (d.health[k]) localStorage.setItem(`health_${k}`, JSON.stringify(d.health[k]));
      });
    }
    if (d.aiPlan) localStorage.setItem('app_ai_plan', JSON.stringify(d.aiPlan));
  },

  async pull() {
    if (!this.user()) return null;
    try {
      this.updateStatus('syncing');
      const j = await this._req('/data', { method: 'GET' });
      if (j.data) {
        const cloudT = j.data._t || 0;
        const localT = parseInt(localStorage.getItem('app_last_sync') || '0');
        if (cloudT > localT) {
          this._apply(j.data);
          localStorage.setItem('app_last_sync', String(cloudT));
          this.updateStatus('online');
          return true; // data updated
        }
      } else {
        // 云端还没有数据（首次登录）：把本地已有数据迁移上去
        await this.push();
        return false;
      }
      this.updateStatus('online');
      return false;
    } catch(e) {
      if (e.status === 401) { await this.logout(); }
      console.error('pull failed', e);
      this.updateStatus('error');
      return null;
    }
  },

  async push() {
    if (!this.user()) return;
    try {
      this.updateStatus('syncing');
      const data = this._collect();
      await this._req('/data', { method: 'PUT', body: JSON.stringify({ data }) });
      localStorage.setItem('app_last_sync', String(data._t));
      localStorage.removeItem('app_sync_dirty');
      this.updateStatus('online');
    } catch(e) {
      if (e.status === 401) { await this.logout(); }
      console.error('push failed', e);
      localStorage.setItem('app_sync_dirty', '1');
      this.updateStatus('error');
    }
  },

  schedulePush() {
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.push(), 2000);
  }
};

// ===================== APP OBJECT (global interface) =====================
window.app = {
  onDataChanged(module) {
    if (CloudSync.user()) CloudSync.schedulePush();
    else localStorage.setItem('app_sync_dirty', '1');
  },
  navigateTo(subTab) {
    // Called by health dashboard quick-action buttons
    if (NAV_CONFIG.health.tabs.find(t => t.id === subTab)) {
      currentHealthSubTab = subTab;
      renderSubNav();
      renderHealthTab(subTab, document.getElementById('appMain'));
    }
  }
};

// ===================== NAVIGATION RENDERING =====================
// 子页签：渲染为头部下方的分段控件（#subTabs）；底部 #appNav 是静态主导航
function renderSubNav() {
  const bar = document.getElementById('subTabs');
  const appEl = document.getElementById('app');
  if (!bar || !appEl) return;
  if (currentMainTab === 'profile') {
    bar.innerHTML = '';
    appEl.classList.add('no-subtabs');
    return;
  }
  appEl.classList.remove('no-subtabs');
  const tabs = NAV_CONFIG[currentMainTab]?.tabs || [];
  const currentSub = currentMainTab === 'health' ? currentHealthSubTab : currentPlannerSubTab;
  bar.innerHTML = `<div class="sub-seg">` + tabs.map(t =>
    `<button class="seg-btn ${t.id === currentSub ? 'active' : ''}" data-tab="${t.id}" data-main="${currentMainTab}">${t.label}</button>`
  ).join('') + `</div>`;
  bar.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      const main = btn.dataset.main;
      if (main === 'health') {
        currentHealthSubTab = tab;
        renderSubNav();
        const healthNames = { dashboard:'仪表盘', diet:'饮食记录', weight:'体重管理', exercise:'运动记录' };
        const brandEl = document.getElementById('brandPage');
        if (brandEl) brandEl.textContent = healthNames[tab] || '健康';
        renderHealthTab(tab, document.getElementById('appMain'));
      } else if (main === 'planner') {
        currentPlannerSubTab = tab;
        switchTab(tab); // planner.js global
      }
    });
  });
}

function switchMainTab(tab) {
  currentMainTab = tab;
  // Update top tab buttons
  document.querySelectorAll('.main-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.main === tab));
  renderSubNav();
  const ha = document.getElementById('headerActions');
  if (ha) ha.style.display = 'none';

  if (tab === 'health') {
    const brandEl = document.getElementById('brandPage');
    const names = { dashboard:'仪表盘', diet:'饮食记录', weight:'体重管理', exercise:'运动记录' };
    if (brandEl) brandEl.textContent = names[currentHealthSubTab] || '健康';
    renderHealthTab(currentHealthSubTab, document.getElementById('appMain'));
  } else if (tab === 'planner') {
    if (!plannerInitialized) {
      plannerInitialized = true;
      plannerInit(); // planner.js: sets up event listeners and renders
    } else {
      switchTab(currentPlannerSubTab);
    }
    // Update planner sub-nav highlight
    document.querySelectorAll('.seg-btn[data-main="planner"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === currentPlannerSubTab);
    });
  } else if (tab === 'profile') {
    renderProfilePage();
  }
}

// ===================== PROFILE PAGE =====================
function renderProfilePage() {
  const main = document.getElementById('appMain');
  if (!main) return;
  const brandEl = document.getElementById('brandPage');
  if (brandEl) brandEl.textContent = '我的';

  // Planner stats
  const totalHours = typeof getTotalHoursAllTime === 'function' ? getTotalHoursAllTime() : 0;
  const streakDays = typeof getStreakDays === 'function' ? getStreakDays() : 0;
  const activeDays = typeof getActiveDays === 'function' ? getActiveDays() : 0;

  // Health profile
  const hp = healthData.profile || {};
  const goals = healthData.goals || {};
  const latestWeight = healthGetLatestWeight();
  const bmi = hp.height && latestWeight ? calculateBMI(latestWeight.weight, hp.height) : null;
  const plannerProfile = (typeof state !== 'undefined') ? state.profile : { name:'', avatar:'🧑' };

  // Cloud sync state
  const cloudUser = CloudSync.user();

  main.innerHTML = `
    <div class="tab-content">
      <div class="section">
        <div class="profile-avatar-section">
          <div class="avatar" id="btnEditAvatar" style="cursor:pointer">${plannerProfile.avatar || '🧑'}</div>
          <div class="profile-name">${plannerProfile.name || '点击设置名字'}</div>
          <div class="profile-subtitle">已坚持 ${streakDays} 天 · 累计 ${totalHours.toFixed(0)} 小时</div>
          <button class="btn-edit-profile" id="btnEditProfileMain">✏️ 编辑资料</button>
        </div>
      </div>

      <div class="section">
        <div class="profile-stats-row">
          <div class="profile-stat-item"><div class="profile-stat-val">${totalHours.toFixed(0)}</div><div class="profile-stat-label">打卡时长</div></div>
          <div class="profile-stat-item"><div class="profile-stat-val">${activeDays}</div><div class="profile-stat-label">打卡天数</div></div>
          <div class="profile-stat-item"><div class="profile-stat-val">${streakDays}</div><div class="profile-stat-label">连续打卡</div></div>
        </div>
      </div>

      <div class="section">
        <div class="ai-plan-entry-card" id="aiPlanEntryCard">
          <div class="ai-plan-entry-icon">✨</div>
          <div class="ai-plan-entry-text">
            <div class="ai-plan-entry-title">AI 健康计划</div>
            <div class="ai-plan-entry-sub" id="aiPlanEntrySub">根据你的信息，生成专属饮食+运动计划</div>
          </div>
          <span class="ai-plan-entry-arrow">›</span>
        </div>
      </div>

      <div class="section">
        <div class="profile-section-title">健康信息</div>
        <div class="profile-form">
          <div class="form-row">
            <label>身高</label>
            <input type="number" id="profileHeight" class="text-input small-input" value="${hp.height||''}" placeholder="cm" min="100" max="250">
          </div>
          <div class="form-row">
            <label>年龄</label>
            <input type="number" id="profileAge" class="text-input small-input" value="${hp.age||''}" placeholder="岁" min="1" max="120">
          </div>
          <div class="form-row">
            <label>性别</label>
            <select id="profileGender" class="text-input small-input">
              <option value="male" ${hp.gender==='male'?'selected':''}>男</option>
              <option value="female" ${hp.gender==='female'?'selected':''}>女</option>
              <option value="other" ${hp.gender==='other'?'selected':''}>其他</option>
            </select>
          </div>
          ${bmi ? `<div class="form-row"><label>BMI</label><span style="color:#667eea;font-weight:600">${bmi} (${getBMIStatus(bmi)})</span></div>` : ''}
          <button class="btn-save" id="btnSaveHealthProfile" style="margin-top:8px">保存健康信息</button>
        </div>
      </div>

      <div class="section">
        <div class="profile-section-title">每日目标</div>
        <div class="profile-form">
          <div class="form-row"><label>卡路里目标</label><input type="number" id="goalCalories" class="text-input small-input" value="${goals.dailyCalories||2000}" placeholder="kcal"></div>
          <div class="form-row"><label>饮水目标</label><input type="number" id="goalWater" class="text-input small-input" value="${goals.dailyWater||2000}" placeholder="ml"></div>
          <div class="form-row"><label>运动目标</label><input type="number" id="goalExercise" class="text-input small-input" value="${goals.dailyExercise||30}" placeholder="分钟"></div>
          <div class="form-row"><label>目标体重</label><input type="number" id="goalWeight" class="text-input small-input" value="${goals.weight||''}" placeholder="kg" step="0.1"></div>
          <button class="btn-save" id="btnSaveGoals" style="margin-top:8px">保存目标</button>
        </div>
      </div>

      <div class="section cloud-sync-section">
        <div class="profile-section-title">☁️ 云端同步</div>
        <div class="cloud-sync-card">
          ${cloudUser ? `
            <div class="sync-status-row"><span>账号：</span><span>${localStorage.getItem('app_email') || cloudUser}</span></div>
            <div class="sync-status-row" id="syncStatusRow">
              <span>同步状态：</span><span id="syncStatusBadge">✓ 已登录，数据自动同步</span>
            </div>
            <button class="btn-cloud-sync" id="btnManualSync">立即同步</button>
            <button class="btn-cloud-sync" id="btnLogout" style="margin-top:8px">退出登录</button>
          ` : CloudSync.configured ? `
            <div style="font-size:13px;color:var(--text2);margin-bottom:8px">登录后，数据保存到云端，换浏览器/设备也能看到。</div>
            <div class="cloud-form">
              <input class="text-input" id="loginEmail" type="email" placeholder="邮箱" autocomplete="email">
              <div class="password-wrap">
                <input class="text-input" id="loginPassword" type="password" placeholder="密码（至少6位）" autocomplete="current-password">
                <button type="button" class="btn-toggle-pw" id="btnTogglePw" aria-label="显示密码">👁</button>
              </div>
              <button class="btn-save" id="btnLogin">登录</button>
              <button class="btn-cloud-sync" id="btnSignup">注册新账号</button>
            </div>
          ` : `
            <div style="font-size:13px;color:var(--text3)">云同步需要通过网址访问才能使用（本地双击打开文件无法登录）。请用部署后的网址打开本应用。</div>
          `}
        </div>
      </div>

      <div class="section">
        <div class="profile-section-title">数据管理</div>
        <div class="setting-list">
          <div class="setting-item" id="settingManageActs"><div class="setting-left"><span class="setting-icon">✏️</span><span class="setting-label">管理打卡活动</span></div><span class="setting-arrow">›</span></div>
          <div class="setting-item" id="settingExportPlanner"><div class="setting-left"><span class="setting-icon">📤</span><span class="setting-label">导出打卡数据</span></div><span class="setting-arrow">›</span></div>
          <div class="setting-item" id="settingImportPlanner"><div class="setting-left"><span class="setting-icon">📥</span><span class="setting-label">导入打卡数据</span></div><span class="setting-arrow">›</span></div>
          <div class="setting-item" id="settingResetAll"><div class="setting-left"><span class="setting-icon" style="color:#FF3B30">🗑️</span><span class="setting-label" style="color:#FF3B30">清空所有数据</span></div><span class="setting-arrow">›</span></div>
        </div>
      </div>
    </div>`;

  // AI plan entry card
  const aiCard = document.getElementById('aiPlanEntryCard');
  if (aiCard && typeof aiPlanLoad === 'function') {
    const existingPlan = aiPlanLoad();
    if (existingPlan) {
      const sub = document.getElementById('aiPlanEntrySub');
      if (sub) sub.textContent = '查看或重新生成你的健康计划';
      aiCard.addEventListener('click', () => { if (typeof viewAIPlan === 'function') viewAIPlan(); });
    } else {
      aiCard.addEventListener('click', () => { if (typeof openAIPlanWizard === 'function') openAIPlanWizard(); });
    }
  }

  document.getElementById('btnEditProfileMain')?.addEventListener('click', () => {
    if (typeof openEditProfileModal === 'function') {
      openEditProfileModal();
      // After close, re-render profile page
      const bd = document.getElementById('modalBackdrop');
      const obs = new MutationObserver((mutations) => {
        mutations.forEach(m => {
          if (!m.target.classList.contains('show')) { obs.disconnect(); setTimeout(() => renderProfilePage(), 100); }
        });
      });
      obs.observe(document.getElementById('modalBackdrop'), { attributes: true, attributeFilter: ['class'] });
    }
  });
  document.getElementById('btnEditAvatar')?.addEventListener('click', () => {
    if (typeof openEditProfileModal === 'function') openEditProfileModal();
  });
  document.getElementById('btnSaveHealthProfile')?.addEventListener('click', () => {
    const height = parseFloat(document.getElementById('profileHeight').value) || null;
    const age = parseInt(document.getElementById('profileAge').value) || null;
    const gender = document.getElementById('profileGender').value;
    healthSave('profile', { ...healthData.profile, height, age, gender });
    healthShowToast('健康信息已保存');
  });
  document.getElementById('btnSaveGoals')?.addEventListener('click', () => {
    const dailyCalories = parseInt(document.getElementById('goalCalories').value) || 2000;
    const dailyWater = parseInt(document.getElementById('goalWater').value) || 2000;
    const dailyExercise = parseInt(document.getElementById('goalExercise').value) || 30;
    const weight = parseFloat(document.getElementById('goalWeight').value) || null;
    healthSave('goals', { ...healthData.goals, dailyCalories, dailyWater, dailyExercise, weight });
    healthShowToast('目标已保存');
  });
  const doAuth = async (mode) => {
    const email = document.getElementById('loginEmail')?.value.trim() || '';
    const pw = document.getElementById('loginPassword')?.value || '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { healthShowToast('请输入有效邮箱'); return; }
    if (pw.length < 6) { healthShowToast('密码至少6位'); return; }
    const btnL = document.getElementById('btnLogin');
    const btnS = document.getElementById('btnSignup');
    const busy = (on) => {
      [btnL, btnS].forEach(b => { if (b) b.disabled = on; });
      if (btnL) btnL.textContent = on ? (mode === 'signup' ? '注册中…' : '登录中…') : '登录';
      if (btnS) btnS.textContent = on ? '请稍候' : '注册新账号';
    };
    busy(true);
    try {
      if (mode === 'signup') await CloudSync.signup(email, pw);
      await CloudSync.login(email, pw);
      localStorage.removeItem('app_last_sync'); // 登录后以云端数据为准
      healthShowToast(mode === 'signup' ? '注册成功，已登录 ✓' : '登录成功 ✓');
      await CloudSync.pull();
      if (typeof load === 'function') load();
      if (typeof healthLoad === 'function') healthLoad();
      renderProfilePage();
    } catch(e) {
      console.error('auth failed', e);
      busy(false);
      healthShowToast(CloudSync.errMsg(e));
    }
  };
  document.getElementById('btnLogin')?.addEventListener('click', () => doAuth('login'));
  document.getElementById('btnSignup')?.addEventListener('click', () => doAuth('signup'));
  document.getElementById('btnTogglePw')?.addEventListener('click', () => {
    const pw = document.getElementById('loginPassword');
    if (pw) pw.type = pw.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await CloudSync.logout();
    healthShowToast('已退出登录');
    renderProfilePage();
  });
  document.getElementById('btnManualSync')?.addEventListener('click', () => {
    CloudSync.push().then(() => healthShowToast('同步完成 ✓'));
  });
  document.getElementById('settingManageActs')?.addEventListener('click', () => {
    if (typeof openManageActivitiesModal === 'function') openManageActivitiesModal();
  });
  document.getElementById('settingExportPlanner')?.addEventListener('click', () => {
    if (typeof exportPlannerData === 'function') exportPlannerData();
  });
  document.getElementById('settingImportPlanner')?.addEventListener('click', () => {
    if (typeof importPlannerData === 'function') importPlannerData();
  });
  document.getElementById('settingResetAll')?.addEventListener('click', () => {
    healthConfirm('确定要清空所有数据吗？<br><b style="color:var(--danger)">此操作不可恢复！</b>', () => {
      // 保留 LeanCloud 登录会话(AV/ 开头的键)，只清业务数据
      const sessionBackup = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('AV/')) sessionBackup[k] = localStorage.getItem(k);
      }
      localStorage.clear();
      Object.entries(sessionBackup).forEach(([k, v]) => localStorage.setItem(k, v));
      if (typeof load === 'function') load();
      healthLoad();
      if (CloudSync.user()) CloudSync.push(); // 同时清空云端，避免下次拉回旧数据
      renderProfilePage();
      healthShowToast('数据已清空');
    }, '清空');
  });
}

// ===================== INITIALIZATION =====================
function initApp() {
  // Load all data first
  if (typeof load === 'function') load();           // planner.js
  if (typeof healthLoad === 'function') healthLoad(); // health.js

  // Setup main tab click handlers
  document.querySelectorAll('.main-tab').forEach(btn => {
    btn.addEventListener('click', () => switchMainTab(btn.dataset.main));
  });

  // Setup modal backdrop (shared across modules)
  document.getElementById('modalBackdrop')?.addEventListener('click', () => {
    if (typeof closeModal === 'function') closeModal();
  });

  // Init cloud sync; if already logged in, pull on startup
  if (CloudSync.init() && CloudSync.user()) {
    CloudSync.pull().then(updated => {
      if (updated) {
        if (typeof load === 'function') load();
        if (typeof healthLoad === 'function') healthLoad();
        // Re-render current view
        switchMainTab(currentMainTab);
      }
    });
  }

  // Flush any pending dirty sync when page regains focus
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && CloudSync.user() && localStorage.getItem('app_sync_dirty')) {
      CloudSync.push();
    }
  });

  // Start with health dashboard
  switchMainTab('health');
}

document.addEventListener('DOMContentLoaded', initApp);
