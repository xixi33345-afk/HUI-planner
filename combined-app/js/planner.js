'use strict';
// ===================== PLANNER MODULE =====================
// Adapted for combined app: no auto-init, cloud sync hook added

const DEFAULT_ACTIVITIES = [
  { id:'a1', name:'阅读', short:'阅读', emoji:'📚', color:'#4CAF50', targetHours:1, activeDays:null, group:'' },
  { id:'a2', name:'运动', short:'运动', emoji:'💪', color:'#2196F3', targetHours:0.5, activeDays:null, group:'' },
  { id:'a3', name:'学习', short:'学习', emoji:'📝', color:'#FF9800', targetHours:2, activeDays:null, group:'' },
];

const BADGE_DEFS = [
  { id:'streak_7',   type:'streak', threshold:7,   label:'7天坚持',   shape:'shield', color:'#4FC3F7', glow:'#0288D1' },
  { id:'streak_30',  type:'streak', threshold:30,  label:'30天坚持',  shape:'shield', color:'#90CAF9', glow:'#1976D2' },
  { id:'streak_50',  type:'streak', threshold:50,  label:'50天坚持',  shape:'shield', color:'#B0BEC5', glow:'#607D8B' },
  { id:'streak_100', type:'streak', threshold:100, label:'100天坚持', shape:'shield', color:'#FFD700', glow:'#F9A825' },
  { id:'hours_50',   type:'hours',  threshold:50,  label:'50小时',   shape:'star',   color:'#90CAF9', glow:'#1976D2' },
  { id:'hours_100',  type:'hours',  threshold:100, label:'100小时',  shape:'star',   color:'#64B5F6', glow:'#1565C0' },
  { id:'hours_150',  type:'hours',  threshold:150, label:'150小时',  shape:'star',   color:'#B0BEC5', glow:'#607D8B' },
  { id:'hours_200',  type:'hours',  threshold:200, label:'200小时',  shape:'star',   color:'#FFD700', glow:'#F9A825' },
  { id:'hours_500',  type:'hours',  threshold:500, label:'500小时',  shape:'star',   color:'#FF8A65', glow:'#E64A19' },
  { id:'days_7',     type:'days',   threshold:7,   label:'7天打卡',  shape:'hex',    color:'#A5D6A7', glow:'#388E3C' },
  { id:'days_30',    type:'days',   threshold:30,  label:'30天打卡', shape:'hex',    color:'#81C784', glow:'#2E7D32' },
  { id:'days_100',   type:'days',   threshold:100, label:'100天打卡',shape:'hex',    color:'#FFD54F', glow:'#F57F17' },
];

const EMOJIS = ['📷','🎨','🎮','📝','📚','🌍','📖','💪','📓','🎯','🎵','🏃','🧘','🍎','💻','✏️','🔬','🎭','🏋️','🤸'];
const COLORS = ['#4CAF50','#2196F3','#FF9800','#E91E63','#9C27B0','#00BCD4','#FF5722','#607D8B','#795548','#F44336','#3F51B5','#009688'];
const DAY_NAMES = ['日','一','二','三','四','五','六'];

// ===================== STATE =====================
const state = { tab:'checkin', date:todayStr(), activities:[], logs:{}, notes:{}, chart:null, profile:{ name:'', avatar:'🧑' } };
let activeTimer = null;
let timerTick = null;
let analyticsView = 'week';
let viewYear = new Date().getFullYear();
let viewMonthIdx = new Date().getMonth();
let sortMode = false;
let collapsedGroups = new Set();

// ===================== UTILS =====================
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function formatDate(str) {
  const d = new Date(str + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
function addDays(str, n) {
  const d = new Date(str + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function getLogsForDate(date) { return state.logs[date] || []; }
function getTotalHoursForDate(date) { return getLogsForDate(date).reduce((s,e) => s + (e.hours||0), 0); }
function getTotalHoursAllTime() { return Object.values(state.logs).flat().reduce((s,e) => s + (e.hours||0), 0); }
function getActiveDays() { return Object.keys(state.logs).filter(d => state.logs[d] && state.logs[d].length > 0).length; }
function getStreakDays() {
  let streak = 0, d = todayStr();
  while (true) {
    const logs = state.logs[d];
    if (logs && logs.some(e => e.hours > 0)) { streak++; d = addDays(d, -1); } else break;
  }
  return streak;
}
function getActivityById(id) { return state.activities.find(a => a.id === id); }
function getLogEntry(date, actId) { return (state.logs[date]||[]).find(e => e.activityId === actId); }
function pad2(n) { return String(n).padStart(2,'0'); }
function getDailyTargetRate(date) {
  const dow = new Date(date + 'T00:00:00').getDay();
  const acts = state.activities.filter(a => a.targetHours > 0 && (!a.activeDays || a.activeDays.includes(dow)));
  if (!acts.length) return null;
  const met = acts.filter(a => { const e = getLogEntry(date, a.id); return e && e.hours >= a.targetHours; }).length;
  return met / acts.length;
}
function getActivityStreak(actId) {
  let streak = 0, d = todayStr();
  while (true) {
    const e = getLogEntry(d, actId);
    if (e && e.hours > 0) { streak++; d = addDays(d, -1); } else break;
  }
  return streak;
}
function parseHMM(str) {
  const m = str.trim().match(/^(\d+):(\d{1,2})$/);
  if (m) return parseInt(m[1]) + parseInt(m[2]) / 60;
  const f = parseFloat(str);
  return isNaN(f) ? null : f;
}

// ===================== TIMER =====================
function formatElapsed(ms) {
  const s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(sec)}`;
  return `${pad2(m)}:${pad2(sec)}`;
}
function getElapsedMs() {
  if (!activeTimer) return 0;
  const base = activeTimer.accumulatedMs || 0;
  if (activeTimer.timerState === 'paused') return base;
  return base + (Date.now() - activeTimer.startTime);
}
function saveTimer() {
  if (activeTimer) localStorage.setItem('planner_timer', JSON.stringify(activeTimer));
  else localStorage.removeItem('planner_timer');
}
function clearTimer() {
  activeTimer = null;
  if (timerTick) { clearInterval(timerTick); timerTick = null; }
  localStorage.removeItem('planner_timer');
  const pill = document.getElementById('timerPill');
  if (pill) { pill.innerHTML = ''; pill.style.display = 'none'; }
}
function startTimer(actId) {
  if (activeTimer) stopTimer(true);
  activeTimer = { activityId: actId, startTime: Date.now(), accumulatedMs: 0, timerState: 'running', mode: 'stopwatch' };
  clearInterval(timerTick);
  timerTick = setInterval(tickTimer, 1000);
  tickTimer(); saveTimer(); renderTab(state.tab);
  const act = getActivityById(actId);
  showToast(`⏱ 开始计时：${act ? act.emoji + ' ' + act.short : ''}`);
}
function pauseTimer() {
  if (!activeTimer || activeTimer.timerState !== 'running') return;
  activeTimer.accumulatedMs = getElapsedMs();
  activeTimer.timerState = 'paused';
  clearInterval(timerTick); timerTick = null;
  saveTimer(); tickTimer(); renderTab(state.tab);
  showToast('⏸ 计时已暂停');
}
function resumeTimer() {
  if (!activeTimer || activeTimer.timerState !== 'paused') return;
  activeTimer.startTime = Date.now();
  activeTimer.timerState = 'running';
  clearInterval(timerTick);
  timerTick = setInterval(tickTimer, 1000);
  tickTimer(); saveTimer(); renderTab(state.tab);
  showToast('▶ 计时继续');
}
function stopTimer(silent) {
  if (!activeTimer) return;
  const elapsedMs = getElapsedMs();
  const elapsedH = elapsedMs / 3600000;
  const actId = activeTimer.activityId;
  const today = todayStr();
  clearTimer();
  if (elapsedH >= 1/120) {
    const existing = getLogEntry(today, actId);
    const newH = Math.round(((existing ? existing.hours : 0) + elapsedH) * 100) / 100;
    setLogEntry(today, actId, newH);
    save();
    if (!silent) { const mins = Math.max(1, Math.round(elapsedH * 60)); showToast(`✅ +${mins}分钟 已记录`); }
  } else {
    if (!silent) showToast('计时时间过短，未记录');
  }
  renderTab(state.tab);
}
function startPomodoro(actId, workMin) {
  if (activeTimer) stopTimer(true);
  activeTimer = { activityId: actId, startTime: Date.now(), accumulatedMs: 0, timerState: 'running', mode: 'pomodoro', pomodoroPhase: 'work', pomodoroPhaseStart: Date.now(), pomodoroWorkMin: workMin };
  clearInterval(timerTick);
  timerTick = setInterval(tickTimer, 1000);
  tickTimer(); saveTimer(); renderTab(state.tab);
  const act = getActivityById(actId);
  showToast(`🍅 番茄钟开始 ${workMin}min：${act ? act.emoji + ' ' + act.short : ''}`);
}
function stopPomodoro() {
  if (!activeTimer || activeTimer.mode !== 'pomodoro') return;
  const elapsedMs = getElapsedMs();
  const elapsedH = elapsedMs / 3600000;
  const actId = activeTimer.activityId;
  const today = todayStr();
  activeTimer.pomodoroPhase = 'break';
  activeTimer.pomodoroPhaseStart = Date.now();
  activeTimer.accumulatedMs = elapsedMs;
  saveTimer();
  if (elapsedH > 0) {
    const existing = getLogEntry(today, actId);
    const newH = Math.round(((existing ? existing.hours : 0) + elapsedH) * 100) / 100;
    setLogEntry(today, actId, newH);
    save();
  }
  showToast(`🍅 完成一个番茄！休息5分钟`);
  renderTab(state.tab);
}
function tickTimer() {
  if (!activeTimer) return;
  const act = getActivityById(activeTimer.activityId);
  const pill = document.getElementById('timerPill');
  const isPaused = activeTimer.timerState === 'paused';
  const isPomodoro = activeTimer.mode === 'pomodoro';
  if (isPomodoro) {
    const phaseElapsed = Date.now() - activeTimer.pomodoroPhaseStart;
    if (activeTimer.pomodoroPhase === 'work') {
      const remaining = activeTimer.pomodoroWorkMin * 60000 - phaseElapsed;
      if (remaining <= 0 && activeTimer.timerState === 'running') { stopPomodoro(); return; }
      const str = formatElapsed(Math.max(0, remaining));
      if (pill) { pill.style.display = 'flex'; pill.className = 'timer-pill timer-pill-pomodoro'; pill.innerHTML = `🍅 <span style="font-variant-numeric:tabular-nums">${str}</span>`; }
      const md = document.getElementById('modalTimerDisplay'); if (md) md.textContent = str;
    } else {
      const remaining = 5 * 60000 - (Date.now() - activeTimer.pomodoroPhaseStart);
      if (remaining <= 0) { showToast('☕ 休息结束！'); clearTimer(); renderTab(state.tab); return; }
      const str = formatElapsed(remaining);
      if (pill) { pill.style.display = 'flex'; pill.className = 'timer-pill timer-pill-break'; pill.innerHTML = `☕ <span style="font-variant-numeric:tabular-nums">${str}</span>`; }
      const md = document.getElementById('modalTimerDisplay'); if (md) md.textContent = str;
    }
    return;
  }
  const elapsed = getElapsedMs();
  const str = formatElapsed(elapsed);
  if (pill) {
    pill.style.display = 'flex';
    pill.className = isPaused ? 'timer-pill timer-pill-paused' : 'timer-pill';
    pill.innerHTML = `${act ? act.emoji : '⏱'} <span style="font-variant-numeric:tabular-nums">${str}</span>${isPaused ? ' ⏸' : ''}`;
  }
  const md = document.getElementById('modalTimerDisplay'); if (md) md.textContent = str;
}

// ===================== STORAGE =====================
function save() {
  localStorage.setItem('planner_activities', JSON.stringify(state.activities));
  localStorage.setItem('planner_logs', JSON.stringify(state.logs));
  localStorage.setItem('planner_profile', JSON.stringify(state.profile));
  localStorage.setItem('planner_notes', JSON.stringify(state.notes));
  // Notify app for cloud sync
  window.app?.onDataChanged?.('planner');
}
function load() {
  try {
    const acts = localStorage.getItem('planner_activities');
    if (acts) {
      state.activities = JSON.parse(acts);
      state.activities.forEach(a => {
        if (a.targetHours === undefined) a.targetHours = 0;
        if (a.activeDays === undefined) a.activeDays = null;
        if (a.group === undefined) a.group = '';
      });
    } else {
      state.activities = JSON.parse(JSON.stringify(DEFAULT_ACTIVITIES));
    }
    const logs = localStorage.getItem('planner_logs');
    if (logs) state.logs = JSON.parse(logs);
    const profile = localStorage.getItem('planner_profile');
    if (profile) state.profile = JSON.parse(profile);
    const notes = localStorage.getItem('planner_notes');
    if (notes) state.notes = JSON.parse(notes);
    const cg = localStorage.getItem('planner_collapsed_groups');
    if (cg) collapsedGroups = new Set(JSON.parse(cg));
    const savedTimer = localStorage.getItem('planner_timer');
    if (savedTimer) {
      activeTimer = JSON.parse(savedTimer);
      if (activeTimer.timerState === 'running') {
        timerTick = setInterval(tickTimer, 1000);
        tickTimer();
      }
    }
  } catch(e) {
    state.activities = JSON.parse(JSON.stringify(DEFAULT_ACTIVITIES));
  }
  if (!localStorage.getItem('planner_initialized')) {
    localStorage.setItem('planner_initialized', '1');
  }
}

// ===================== BADGE SVG =====================
function lighten(hex, amt) {
  let c = parseInt(hex.slice(1),16);
  let r = Math.min(255,(c>>16)+amt), g = Math.min(255,((c>>8)&0xff)+amt), b = Math.min(255,(c&0xff)+amt);
  return `#${pad2(r.toString(16))}${pad2(g.toString(16))}${pad2(b.toString(16))}`;
}
function shieldSVG(color,glow) {
  return `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g${color.slice(1)}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${lighten(color,30)};stop-opacity:1"/><stop offset="100%" style="stop-color:${color};stop-opacity:1"/></linearGradient><filter id="f${color.slice(1)}"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${glow}" flood-opacity="0.4"/></filter></defs><path d="M30 4 L52 14 L52 34 C52 46 42 54 30 57 C18 54 8 46 8 34 L8 14 Z" fill="url(#g${color.slice(1)})" filter="url(#f${color.slice(1)})"/><path d="M30 9 L47 17.5 L47 33.5 C47 43 38.5 50 30 52.5 C21.5 50 13 43 13 33.5 L13 17.5 Z" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/></svg>`;
}
function starSVG(color,glow) {
  return `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gs${color.slice(1)}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${lighten(color,30)};stop-opacity:1"/><stop offset="100%" style="stop-color:${color};stop-opacity:1"/></linearGradient><filter id="fs${color.slice(1)}"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="${glow}" flood-opacity="0.45"/></filter></defs><path d="M30 5 L35.5 21.5 L53 21.5 L39.5 31.5 L44.5 48 L30 38 L15.5 48 L20.5 31.5 L7 21.5 L24.5 21.5 Z" fill="url(#gs${color.slice(1)})" filter="url(#fs${color.slice(1)})"/></svg>`;
}
function hexSVG(color,glow) {
  return `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gh${color.slice(1)}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${lighten(color,30)};stop-opacity:1"/><stop offset="100%" style="stop-color:${color};stop-opacity:1"/></linearGradient><filter id="fh${color.slice(1)}"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${glow}" flood-opacity="0.4"/></filter></defs><polygon points="30,5 52,17 52,43 30,55 8,43 8,17" fill="url(#gh${color.slice(1)})" filter="url(#fh${color.slice(1)})"/></svg>`;
}
function getBadgeSVG(b) {
  if (b.shape==='shield') return shieldSVG(b.color,b.glow);
  if (b.shape==='star')   return starSVG(b.color,b.glow);
  return hexSVG(b.color,b.glow);
}
function getBadgeNumLabel(b) {
  if (b.type==='streak'||b.type==='days')
    return `<span class="badge-num-val">${b.threshold}</span><span class="badge-num-unit">DAYS</span>`;
  return `<span class="badge-num-val">${b.threshold}</span><span class="badge-num-unit">HRS</span>`;
}
function computeUnlockedBadges() {
  const streak=getStreakDays(), hours=getTotalHoursAllTime(), days=getActiveDays();
  return BADGE_DEFS.filter(b => {
    if (b.type==='streak') return streak>=b.threshold;
    if (b.type==='hours')  return hours>=b.threshold;
    if (b.type==='days')   return days>=b.threshold;
    return false;
  });
}

// ===================== CHART =====================
function destroyChart() { if (state.chart) { state.chart.destroy(); state.chart=null; } }
function buildChart(logs) {
  destroyChart();
  const canvas = document.getElementById('donutCanvas');
  if (!canvas) return;
  const entries = logs.filter(e => e.hours>0);
  if (!entries.length) return;
  const acts = entries.map(e => getActivityById(e.activityId)).filter(Boolean);
  const data = entries.map(e => e.hours);
  const colors = acts.map(a => a.color);
  const total = data.reduce((s,v) => s+v, 0);
  const centerPlugin = {
    id:'centerLabel',
    afterDraw(chart) {
      const {ctx,chartArea} = chart;
      const cx=(chartArea.left+chartArea.right)/2, cy=(chartArea.top+chartArea.bottom)/2;
      ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.font='500 11px Inter,sans-serif'; ctx.fillStyle='#8E8E93';
      ctx.fillText('Today Total', cx, cy-22);
      ctx.font='900 38px Inter,sans-serif'; ctx.fillStyle='#1C1C1E';
      ctx.fillText(total.toFixed(1), cx, cy+6);
      ctx.font='500 12px Inter,sans-serif'; ctx.fillStyle='#8E8E93';
      ctx.fillText('hours', cx, cy+28); ctx.restore();
    }
  };
  state.chart = new Chart(canvas, {
    type:'doughnut',
    data:{ labels:acts.map(a=>a.short), datasets:[{data, backgroundColor:colors, borderWidth:3, borderColor:'#fff', hoverOffset:6}] },
    options:{ cutout:'68%', plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:ctx=>` ${ctx.label}  ${ctx.raw.toFixed(1)}h (${((ctx.raw/total)*100).toFixed(0)}%)` }}}, animation:{animateRotate:true, duration:900} },
    plugins:[centerPlugin]
  });
}

// ===================== ANALYTICS TAB =====================
function renderWeeklySummary(root) {
  const today = todayStr();
  const days = [];
  let weekTotal = 0, bestH = 0;
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const h = getTotalHoursForDate(d);
    const dow = new Date(d+'T00:00:00').getDay();
    const rate = getDailyTargetRate(d);
    days.push({ label: i===0 ? '今' : DAY_NAMES[dow], hours:h, isToday:i===0, rate });
    weekTotal += h;
    if (h > bestH) bestH = h;
  }
  const maxH = Math.max(bestH, 1);
  const div = document.createElement('div');
  div.className = 'section';
  div.innerHTML = `<div class="week-summary-card">
    <div class="week-summary-head">
      <span class="week-summary-title">本周概览</span>
      <span class="week-summary-total">${weekTotal.toFixed(1)}<span style="font-size:12px;opacity:0.7;margin-left:2px">h</span></span>
    </div>
    <div class="week-bars">
      ${days.map(d => {
        const fillH = Math.max(d.hours > 0 ? 6 : 0, Math.round((d.hours/maxH)*100));
        return `<div class="week-bar-item ${d.isToday ? 'week-today' : ''}">
          <div class="week-bar-hours-label">${d.hours > 0 ? d.hours.toFixed(1) : ''}</div>
          <div class="week-bar-track"><div class="week-bar-fill" style="height:${fillH}%"></div></div>
          <div class="week-bar-day">${d.label}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
  root.appendChild(div);
}

function renderMonthlyAnalytics(root) {
  const today = todayStr();
  const now = new Date();
  const yr = viewYear, mo = viewMonthIdx;
  const isCurrentMonth = yr === now.getFullYear() && mo === now.getMonth();
  const monthLabel = `${yr}年${mo+1}月`;
  const daysInMonth = new Date(yr, mo+1, 0).getDate();
  let totalH = 0, activeDays = 0, maxDayH = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yr}-${pad2(mo+1)}-${pad2(d)}`;
    if (dateStr > today) break;
    const h = getTotalHoursForDate(dateStr);
    totalH += h; if (h > 0) activeDays++; if (h > maxDayH) maxDayH = h;
  }
  const avgH = activeDays > 0 ? totalH / activeDays : 0;
  const navDiv = document.createElement('div');
  navDiv.className = 'section';
  const canGoNext = !isCurrentMonth;
  navDiv.innerHTML = `<div class="month-nav-card">
    <div class="month-nav-row">
      <button class="btn-month-arrow" id="btnMonthPrev">&#8249;</button>
      <span class="month-nav-label">${monthLabel}</span>
      <button class="btn-month-arrow" id="btnMonthNext" ${canGoNext?'':'disabled'}>&#8250;</button>
    </div>
    <div class="month-stats-row">
      <div class="month-stat"><div class="month-stat-val">${totalH.toFixed(1)}</div><div class="month-stat-label">总时长(h)</div></div>
      <div class="month-stat"><div class="month-stat-val">${activeDays}</div><div class="month-stat-label">活跃天数</div></div>
      <div class="month-stat"><div class="month-stat-val">${avgH.toFixed(1)}</div><div class="month-stat-label">日均(h)</div></div>
      <div class="month-stat"><div class="month-stat-val">${maxDayH.toFixed(1)}</div><div class="month-stat-label">最高单日</div></div>
    </div>
  </div>`;
  root.appendChild(navDiv);
  const heatDiv = document.createElement('div');
  heatDiv.className = 'section';
  const firstDOW = new Date(yr, mo, 1).getDay();
  let calCells = DAY_NAMES.map(n=>`<div class="cal-header">${n}</div>`).join('');
  for (let i = 0; i < firstDOW; i++) calCells += `<div class="cal-day cal-empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yr}-${pad2(mo+1)}-${pad2(d)}`;
    if (dateStr > today) { calCells += `<div class="cal-day cal-future">${d}</div>`; }
    else {
      const h = getTotalHoursForDate(dateStr);
      const lvl = h >= 8 ? 3 : h >= 4 ? 2 : h > 0 ? 1 : 0;
      const isTod = dateStr === today;
      calCells += `<div class="cal-day month-day-${lvl}${isTod?' cal-today':''}">${d}</div>`;
    }
  }
  heatDiv.innerHTML = `<div class="month-heatmap-card"><div class="card-title" style="margin-bottom:12px">打卡热力图</div><div class="cal-grid">${calCells}</div></div>`;
  root.appendChild(heatDiv);
  const actTotals = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yr}-${pad2(mo+1)}-${pad2(d)}`;
    if (dateStr > today) break;
    getLogsForDate(dateStr).forEach(e => { actTotals[e.activityId] = (actTotals[e.activityId]||0) + e.hours; });
  }
  const topActs = Object.entries(actTotals).map(([id,h]) => ({ act:getActivityById(id), h })).filter(x=>x.act).sort((a,b)=>b.h-a.h).slice(0,5);
  if (topActs.length > 0) {
    const maxH2 = topActs[0].h;
    const topDiv = document.createElement('div');
    topDiv.className = 'section';
    topDiv.innerHTML = `<div class="month-top-card"><div class="card-title" style="margin-bottom:12px">活动排行</div>${topActs.map(({act,h}) => `<div class="month-top-item"><div class="month-top-left"><span class="month-top-emoji">${act.emoji}</span><span class="month-top-name">${act.short}</span></div><div class="month-top-bar-wrap"><div class="month-top-bar" style="width:${Math.round((h/maxH2)*100)}%;background:${act.color}"></div></div><span class="month-top-hours">${h.toFixed(1)}h</span></div>`).join('')}</div>`;
    root.appendChild(topDiv);
  }
  requestAnimationFrame(() => {
    document.getElementById('btnMonthPrev')?.addEventListener('click', () => { viewMonthIdx--; if (viewMonthIdx < 0) { viewMonthIdx = 11; viewYear--; } renderTab('analytics'); });
    document.getElementById('btnMonthNext')?.addEventListener('click', () => { if (!canGoNext) return; viewMonthIdx++; if (viewMonthIdx > 11) { viewMonthIdx = 0; viewYear++; } renderTab('analytics'); });
  });
}

function renderAnalytics(root) {
  const toggleDiv = document.createElement('div');
  toggleDiv.className = 'section';
  toggleDiv.innerHTML = `<div class="view-toggle-bar"><button class="view-toggle-btn${analyticsView==='week'?' active':''}" data-view="week">周视图</button><button class="view-toggle-btn${analyticsView==='month'?' active':''}" data-view="month">月视图</button></div>`;
  root.appendChild(toggleDiv);
  requestAnimationFrame(() => { toggleDiv.querySelectorAll('.view-toggle-btn').forEach(btn => { btn.addEventListener('click', () => { analyticsView = btn.dataset.view; renderTab('analytics'); }); }); });
  if (analyticsView === 'month') { renderMonthlyAnalytics(root); return; }
  const logs = getLogsForDate(state.date);
  const sorted = [...logs].sort((a,b) => b.hours-a.hours);
  const total = logs.reduce((s,e) => s+(e.hours||0), 0);
  const isToday = state.date === todayStr();
  const unlocked = computeUnlockedBadges();
  const achDiv = document.createElement('div');
  achDiv.className = 'section';
  achDiv.innerHTML = `<div class="achievements-strip"><div class="achievements-head"><span class="achievements-title">我的成就</span><span class="achievements-count">${unlocked.length}</span></div><div class="badges-scroll">${BADGE_DEFS.slice(0,8).map(b => { const earned=unlocked.find(u=>u.id===b.id); return `<div class="badge ${earned?'':'locked'}"><div class="badge-icon">${getBadgeSVG(b)}<div class="badge-num">${getBadgeNumLabel(b)}</div></div><span class="badge-label">${b.label}</span></div>`; }).join('')}</div></div>`;
  root.appendChild(achDiv);
  renderWeeklySummary(root);
  const weekHours = Array.from({length:7},(_,i)=>getTotalHoursForDate(addDays(todayStr(),-i))).reduce((s,h)=>s+h,0);
  const weekActiveDays = Array.from({length:7},(_,i)=>addDays(todayStr(),-i)).filter(d=>getTotalHoursForDate(d)>0).length;
  const reviewEntryDiv = document.createElement('div');
  reviewEntryDiv.className = 'section';
  reviewEntryDiv.innerHTML = `<div class="review-entry-card" id="btnOpenWeeklyReview"><div class="review-entry-left"><div class="review-entry-title">📊 本周复盘</div><div class="review-entry-sub">本周投入 ${weekHours.toFixed(1)}h · 活跃 ${weekActiveDays} 天</div></div><span class="review-entry-arrow">›</span></div>`;
  root.appendChild(reviewEntryDiv);
  const dailyDiv = document.createElement('div');
  dailyDiv.className = 'section';
  dailyDiv.innerHTML = `<div class="daily-card">
    <div class="daily-nav">
      <span class="daily-nav-title">每日投入</span>
      <div class="daily-date-nav">
        <button class="btn-date-arrow" id="btnPrevDay">&#8249;</button>
        <button class="btn-date-label ${isToday?'is-today':''}" id="btnTodayJump">${formatDate(state.date)}${isToday?' 今':''}</button>
        <button class="btn-date-arrow" id="btnNextDay" ${isToday?'disabled':''}>&#8250;</button>
      </div>
      <button class="btn-share" id="btnShare">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        分享
      </button>
    </div>
    <div class="chart-area" id="chartArea">
      ${total > 0 ? `<div class="chart-wrap"><canvas id="donutCanvas" width="220" height="220"></canvas></div>` : `<div class="empty-chart"><div class="empty-chart-icon">📊</div><div class="empty-chart-text">${isToday?'今日暂无记录':'该日暂无记录'}</div><div class="empty-chart-sub">前往打卡页面记录</div></div>`}
    </div>
    ${sorted.length > 0 ? `<div class="activity-list"><div class="activity-grid">${sorted.map(entry => { const act=getActivityById(entry.activityId); if(!act)return ''; const pct=total>0?Math.round((entry.hours/total)*100):0; return `<div class="activity-item"><div class="activity-icon" style="background:${act.color}22">${act.emoji}</div><div class="activity-info"><div class="activity-name">${act.short}</div><div class="activity-row"><span class="activity-hours">${entry.hours.toFixed(1)}<span class="activity-hours-unit"> h</span></span><span class="activity-pct">${pct}%</span></div><div class="activity-bar"><div class="activity-bar-fill" style="width:${pct}%;background:${act.color}"></div></div></div></div>`; }).join('')}</div></div>` : ''}
  </div>`;
  root.appendChild(dailyDiv);
  requestAnimationFrame(() => {
    if (total > 0) buildChart(logs);
    document.getElementById('btnPrevDay')?.addEventListener('click', () => { state.date=addDays(state.date,-1); renderTab('analytics'); });
    document.getElementById('btnNextDay')?.addEventListener('click', () => { if(state.date<todayStr()){state.date=addDays(state.date,1);renderTab('analytics');} });
    document.getElementById('btnTodayJump')?.addEventListener('click', () => { if(state.date!==todayStr()){state.date=todayStr();renderTab('analytics');showToast('已跳转到今天');} });
    document.getElementById('btnShare')?.addEventListener('click', shareDay);
    document.getElementById('btnOpenWeeklyReview')?.addEventListener('click', openWeeklyReviewModal);
  });
}

// ===================== CHECK-IN TAB =====================
function renderCheckin(root) {
  const today = todayStr();
  const todayLogs = getLogsForDate(today);
  const totalH = todayLogs.reduce((s,e) => s+e.hours, 0);
  const streak = getStreakDays();
  const now = new Date();
  const todayDow = now.getDay();
  const actsWithTarget = state.activities.filter(a => a.targetHours > 0 && (!a.activeDays || a.activeDays.includes(todayDow)));
  const targetMet = actsWithTarget.filter(a => { const e=getLogEntry(today,a.id); return e && e.hours >= a.targetHours; }).length;
  const totalTargetH = actsWithTarget.reduce((s,a) => s+a.targetHours, 0);
  const targetRate = totalTargetH > 0 ? Math.min(1, totalH / totalTargetH) : null;

  const headerDiv = document.createElement('div');
  headerDiv.className = 'section';
  headerDiv.innerHTML = `<div class="checkin-header-card">
    <div class="checkin-header-date">📅 ${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 · 周${DAY_NAMES[now.getDay()]}</div>
    <div class="checkin-header-title">今日任务打卡</div>
    <div class="checkin-stats">
      <div class="checkin-stat"><span class="checkin-stat-val">${totalH.toFixed(1)}<span style="font-size:14px;opacity:0.8">h</span></span><span class="checkin-stat-label">累计投入</span></div>
      <div class="checkin-stat"><span class="checkin-stat-val">${actsWithTarget.length>0 ? `${targetMet}/${actsWithTarget.length}` : `${todayLogs.length}/${state.activities.length}`}</span><span class="checkin-stat-label">${actsWithTarget.length>0 ? '目标达标' : '已打卡'}</span></div>
      <div class="checkin-stat"><span class="checkin-stat-val">🔥${streak}</span><span class="checkin-stat-label">连续天数</span></div>
    </div>
    ${targetRate !== null ? `<div class="checkin-target-progress"><div class="checkin-target-bar-bg"><div class="checkin-target-bar-fill" style="width:${Math.round(targetRate*100)}%"></div></div><span class="checkin-target-pct">${Math.round(targetRate*100)}%</span></div>` : ''}
  </div>`;
  root.appendChild(headerDiv);

  const noteText = state.notes[today] || '';
  const notesDiv = document.createElement('div');
  notesDiv.className = 'section';
  notesDiv.innerHTML = noteText
    ? `<div class="notes-card"><div class="notes-content">${noteText}</div><button class="notes-edit-btn" id="btnEditNote">✏️ 编辑</button></div>`
    : `<button class="notes-empty-btn" id="btnEditNote">💬 今日随记...</button>`;
  root.appendChild(notesDiv);

  // AI plan: today's exercise card
  if (typeof aiPlanGetTodayExercise === 'function') {
    const todayEx = aiPlanGetTodayExercise();
    if (todayEx) {
      const aiDiv = document.createElement('div');
      aiDiv.className = 'section';
      aiDiv.innerHTML = `<div class="ai-today-card">
        <div class="ai-today-header">
          <span class="ai-today-label">✨ AI计划 · 今日运动</span>
          <button class="ai-today-view-btn" onclick="viewAIPlan()">完整计划</button>
        </div>
        <div class="ai-today-exercise">
          <span class="ai-today-exercise-name">${todayEx.name}</span>
          <span class="ai-today-exercise-meta">${todayEx.duration} 分钟${todayEx.calories ? ' · 消耗约 ' + todayEx.calories + ' kcal' : ''}</span>
        </div>
      </div>`;
      root.appendChild(aiDiv);
    }
  }

  if (actsWithTarget.length > 0 && targetMet === actsWithTarget.length) {
    const celebDiv = document.createElement('div');
    celebDiv.className = 'section';
    celebDiv.innerHTML = `<div class="all-done-card"><div class="all-done-icon">🎉</div><div><div class="all-done-text">今日目标全部完成！</div><div class="all-done-sub">太棒了，继续保持！</div></div></div>`;
    root.appendChild(celebDiv);
  }

  const listDiv = document.createElement('div');
  listDiv.className = 'section';
  listDiv.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><div class="checkin-section-title" style="margin-bottom:0">任务列表</div><button class="btn-sort-toggle${sortMode?' active':''}" id="btnToggleSort">${sortMode?'✓ 完成排序':'⇅ 排序'}</button></div>`;
  const taskContainer = document.createElement('div');
  taskContainer.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

  const grouped = {};
  state.activities.forEach((act, idx) => {
    const g = act.group || '';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push({ act, idx });
  });

  Object.entries(grouped).forEach(([groupName, items]) => {
    if (groupName) {
      const isCollapsed = collapsedGroups.has(groupName);
      const ghEl = document.createElement('div');
      ghEl.className = 'group-header'; ghEl.dataset.group = groupName;
      ghEl.innerHTML = `<span class="group-header-name">${groupName}</span><button class="group-collapse-btn">${isCollapsed ? '▶' : '▼'}</button>`;
      taskContainer.appendChild(ghEl);
      if (isCollapsed) return;
    }
    items.forEach(({ act, idx }) => {
      const entry = getLogEntry(today, act.id);
      const hours = entry ? entry.hours : 0;
      const isDone = hours > 0;
      const target = act.targetHours || 0;
      const isActiveDay = !act.activeDays || act.activeDays.includes(todayDow);
      const onTarget = target > 0 && hours >= target && isActiveDay;
      const progress = target > 0 ? Math.min(1, hours / target) : 0;
      const actStreak = getActivityStreak(act.id);
      const timerForThis = activeTimer && activeTimer.activityId === act.id;
      const timerRunning = timerForThis && activeTimer.timerState === 'running';
      const timerPaused = timerForThis && activeTimer.timerState === 'paused';

      const card = document.createElement('div');
      card.className = `task-card ${isDone?'done':''}${sortMode?' sort-mode-card':''}`;
      card.dataset.actId = act.id; card.dataset.actIdx = idx;

      let timerBtn = '';
      if (sortMode) {
        timerBtn = `<div class="timer-controls"><button class="btn-reorder btn-reorder-up" data-idx="${idx}">↑</button><button class="btn-reorder btn-reorder-down" data-idx="${idx}">↓</button></div>`;
      } else if (timerRunning) {
        timerBtn = `<div class="timer-controls"><button class="btn-pause-timer" data-act-id="${act.id}">⏸</button><button class="btn-stop-timer" data-act-id="${act.id}">⏹</button></div>`;
      } else if (timerPaused) {
        timerBtn = `<div class="timer-controls"><button class="btn-resume-timer" data-act-id="${act.id}">▶</button><button class="btn-stop-timer" data-act-id="${act.id}">⏹</button></div>`;
      } else {
        timerBtn = `<button class="btn-add-time" data-act-id="${act.id}">+</button>`;
      }

      let targetRow = '';
      if (!isActiveDay) {
        targetRow = `<div class="task-rest-day">休息日 😌</div>`;
      } else if (target > 0) {
        targetRow = `<div class="task-target-row"><div class="task-target-bar"><div class="task-target-fill ${onTarget?'on-target':''}" style="width:${Math.round(progress*100)}%;background:${onTarget?'#34C759':act.color}"></div></div><span class="task-target-text">${hours>0?hours.toFixed(1)+'h':'0h'} / ${target}h${onTarget?' ✓':''}</span></div>`;
      } else {
        targetRow = `<div class="task-status ${isDone?'done-status':''}">${isDone?'✓ 已打卡':'点击记录时间'}</div>`;
      }

      card.innerHTML = `
        <div class="task-icon-wrap" style="background:${act.color}22" data-act-id="${act.id}">${act.emoji}</div>
        <div class="task-info">
          <div class="task-name">${act.name}</div>
          ${targetRow}
          ${actStreak >= 2 ? `<div class="act-streak-badge">🔥 ${actStreak}天</div>` : ''}
        </div>
        <div class="task-right">
          <div class="task-hours-badge ${isDone?'has-hours':''}">${hours>0?hours.toFixed(1)+'h':'—'}</div>
          ${timerBtn}
        </div>`;
      taskContainer.appendChild(card);
    });
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-task'; addBtn.id = 'btnAddActivity';
  addBtn.innerHTML = `<span style="font-size:22px">＋</span> 添加新活动`;
  taskContainer.appendChild(addBtn);
  listDiv.appendChild(taskContainer);
  root.appendChild(listDiv);

  requestAnimationFrame(() => {
    document.getElementById('btnEditNote')?.addEventListener('click', openNoteModal);
    document.getElementById('btnToggleSort')?.addEventListener('click', () => { sortMode = !sortMode; renderTab('checkin'); });
    root.querySelectorAll('.btn-add-time').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); openTimeModal(btn.dataset.actId); }));
    root.querySelectorAll('.btn-stop-timer').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); stopTimer(); }));
    root.querySelectorAll('.btn-pause-timer').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); pauseTimer(); }));
    root.querySelectorAll('.btn-resume-timer').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); resumeTimer(); }));
    root.querySelectorAll('.task-icon-wrap[data-act-id]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); if (!sortMode) openActivityDetailModal(el.dataset.actId); }));
    root.querySelectorAll('.btn-reorder-up').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); const idx=parseInt(btn.dataset.idx); if(idx>0){[state.activities[idx-1],state.activities[idx]]=[state.activities[idx],state.activities[idx-1]];save();renderTab('checkin');} }));
    root.querySelectorAll('.btn-reorder-down').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); const idx=parseInt(btn.dataset.idx); if(idx<state.activities.length-1){[state.activities[idx],state.activities[idx+1]]=[state.activities[idx+1],state.activities[idx]];save();renderTab('checkin');} }));
    root.querySelectorAll('.group-header').forEach(el => el.addEventListener('click', () => { const g=el.dataset.group; if(collapsedGroups.has(g))collapsedGroups.delete(g);else collapsedGroups.add(g); localStorage.setItem('planner_collapsed_groups',JSON.stringify([...collapsedGroups])); renderTab('checkin'); }));
    document.getElementById('btnAddActivity')?.addEventListener('click', openAddActivityModal);
  });
}

// ===================== ACHIEVEMENTS TAB =====================
function renderAchievements(root) {
  const unlocked = computeUnlockedBadges();
  const streak=getStreakDays(), totalHours=getTotalHoursAllTime(), totalDays=getActiveDays();
  let nextBadge=null, nextProgress=0;
  for (const b of BADGE_DEFS) {
    const cur = b.type==='streak'?streak : b.type==='hours'?totalHours : totalDays;
    if (cur < b.threshold) { nextBadge=b; nextProgress=Math.min(1,cur/b.threshold); break; }
  }
  const pctUnlocked = Math.round((unlocked.length / BADGE_DEFS.length) * 100);

  const headerDiv = document.createElement('div');
  headerDiv.className = 'section';
  headerDiv.innerHTML = `<div class="achievements-page-header">
    <div class="ach-header-row">
      <div>
        <div class="ach-header-title">成就收藏馆</div>
        <div class="ach-header-sub">解锁成就，见证你的成长之路</div>
        ${nextBadge ? `<div class="ach-progress-row" style="margin-top:14px"><div class="ach-progress-bar-bg"><div class="ach-progress-bar-fill" style="width:${Math.round(nextProgress*100)}%"></div></div><span class="ach-progress-label">→ ${nextBadge.label}</span></div>` : `<div style="font-size:13px;opacity:0.7;margin-top:10px">🎉 已解锁全部成就！</div>`}
      </div>
      <div class="ach-ring-wrap">
        <svg class="ach-ring" viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="6"/><circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="6" stroke-dasharray="${Math.round(pctUnlocked * 1.508)} 150.8" stroke-dashoffset="37.7" stroke-linecap="round"/></svg>
        <div class="ach-ring-label"><div class="ach-ring-pct">${pctUnlocked}%</div><div class="ach-ring-sub">解锁</div></div>
      </div>
    </div>
  </div>`;
  root.appendChild(headerDiv);

  const statsDiv = document.createElement('div');
  statsDiv.className = 'section';
  statsDiv.innerHTML = `<div class="stats-row"><div class="stat-mini-card"><div class="stat-mini-icon">🔥</div><div class="stat-mini-val">${streak}</div><div class="stat-mini-label">连续打卡天</div></div><div class="stat-mini-card"><div class="stat-mini-icon">⏱️</div><div class="stat-mini-val">${totalHours.toFixed(0)}</div><div class="stat-mini-label">累计小时</div></div><div class="stat-mini-card"><div class="stat-mini-icon">📆</div><div class="stat-mini-val">${totalDays}</div><div class="stat-mini-label">有记录天数</div></div></div>`;
  root.appendChild(statsDiv);

  ['streak','hours','days'].forEach(g => {
    const groupNames = {streak:'连续坚持', hours:'时间积累', days:'打卡天数'};
    const defs = BADGE_DEFS.filter(b => b.type===g);
    const sec = document.createElement('div'); sec.className = 'section';
    sec.innerHTML = `<div class="badge-section-title">${groupNames[g]}</div><div class="badges-grid">${defs.map(b => {
      const earned = unlocked.find(u=>u.id===b.id);
      const cur = b.type==='streak'?streak : b.type==='hours'?totalHours : totalDays;
      const pct = Math.min(100, Math.round((cur/b.threshold)*100));
      const gapText = b.type==='hours' ? `还差${(b.threshold-cur).toFixed(0)}小时` : `还差${b.threshold-cur}天`;
      return `<div class="badge-grid-item ${earned?'':'locked'}"><div class="badge-grid-icon">${getBadgeSVG(b)}<div class="badge-grid-num">${getBadgeNumLabel(b)}</div></div><div class="badge-grid-label">${b.label}${earned?`<br><span style="color:#34C759;font-size:9px">✓ 已解锁</span>`:`<div class="badge-progress-bar"><div class="badge-progress-fill" style="width:${pct}%"></div></div><span style="color:#C7C7CC;font-size:9px">${gapText}</span>`}</div></div>`;
    }).join('')}</div>`;
    root.appendChild(sec);
  });
}

// ===================== DATA UTILS =====================
function setLogEntry(date, actId, hours) {
  if (!state.logs[date]) state.logs[date] = [];
  const idx = state.logs[date].findIndex(e => e.activityId===actId);
  if (hours<=0) { if(idx>=0) state.logs[date].splice(idx,1); }
  else { if(idx>=0) state.logs[date][idx].hours=hours; else state.logs[date].push({activityId:actId,hours}); }
}

// ===================== TOAST =====================
let toastTimer;
function showToast(msg) {
  let toast = document.getElementById('appToast');
  if (!toast) { toast=document.createElement('div'); toast.className='toast'; toast.id='appToast'; document.body.appendChild(toast); }
  toast.textContent = msg; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>toast.classList.remove('show'), 2200);
}

// ===================== MODAL SYSTEM =====================
function openModal(html) {
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalBackdrop').classList.add('show');
  document.getElementById('modalSheet').classList.add('show');
}
function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('show');
  document.getElementById('modalSheet').classList.remove('show');
}

// ===================== TIME MODAL =====================
function openTimeModal(actId) {
  const act = getActivityById(actId); if (!act) return;
  const today = todayStr(), entry = getLogEntry(today,actId), cur = entry?entry.hours:0;
  const target = act.targetHours||0;
  let val = cur;
  const timerForThis = activeTimer && activeTimer.activityId === actId;
  const timerRunning = timerForThis && activeTimer.timerState === 'running';
  const timerPaused = timerForThis && activeTimer.timerState === 'paused';
  const elapsedStr = timerForThis ? formatElapsed(getElapsedMs()) : '';
  let timerSection = '';
  if (timerRunning) {
    timerSection = `<div class="modal-timer-running"><span class="modal-timer-dot"></span><span>计时中</span><span id="modalTimerDisplay" style="font-variant-numeric:tabular-nums">${elapsedStr}</span><div style="display:flex;gap:6px;margin-left:auto"><button class="btn-stop-timer-modal" id="btnModalPauseTimer">⏸</button><button class="btn-stop-timer-modal" id="btnModalStopTimer">⏹</button></div></div>`;
  } else if (timerPaused) {
    timerSection = `<div class="modal-timer-paused"><span class="modal-timer-orange-dot"></span><span>已暂停</span><span id="modalTimerDisplay" style="font-variant-numeric:tabular-nums">${elapsedStr}</span><div style="display:flex;gap:6px;margin-left:auto"><button class="btn-stop-timer-modal" style="background:#34C759" id="btnModalResumeTimer">▶</button><button class="btn-stop-timer-modal" id="btnModalStopTimer">⏹</button></div></div>`;
  } else {
    timerSection = `<div class="timer-modal-start-row"><button class="btn-start-timer-modal" id="btnModalStartTimer">▶ 开始计时</button></div><div class="timer-modal-pomo-row">${[15,25,50].map(m=>`<button class="btn-start-pomodoro" data-min="${m}">🍅 ${m}min</button>`).join('')}</div>`;
  }
  openModal(`
    <div class="modal-title">${act.emoji} ${act.name}</div>
    ${target>0 ? `<div class="modal-target-hint">每日目标：${target}h${cur>=target?' <span style="color:#34C759">✓ 已达标</span>':' <span style="opacity:0.6">还差${(target-cur).toFixed(1)}h</span>'}</div>` : ''}
    ${timerSection}
    <div class="time-display-wrap"><div class="time-display" id="timeDisplay">${val.toFixed(1)}</div><div class="time-display-unit">小时</div></div>
    <div class="quick-btns-grid">${[0.25,0.5,1,1.5,2,3,4,6].map(v=>`<button class="btn-quick-lg" data-val="${v}">+${v}h</button>`).join('')}</div>
    <div class="precise-input-row"><input class="precise-input" id="preciseInput" placeholder="精确输入 如 1:30"><button class="btn-apply-precise" id="btnApplyPrecise">确认</button></div>
    <button class="btn-time-clear" id="btnClearTime">清零</button>
    <button class="btn-save" id="btnSaveTime">保存</button>
    ${cur>0?`<button class="btn-delete" id="btnDeleteTime">删除记录</button>`:''}
  `);
  document.getElementById('btnModalStartTimer')?.addEventListener('click', () => { closeModal(); startTimer(actId); });
  document.getElementById('btnModalPauseTimer')?.addEventListener('click', () => { closeModal(); pauseTimer(); });
  document.getElementById('btnModalResumeTimer')?.addEventListener('click', () => { closeModal(); resumeTimer(); });
  document.getElementById('btnModalStopTimer')?.addEventListener('click', () => { closeModal(); stopTimer(); });
  document.querySelectorAll('.btn-start-pomodoro').forEach(btn => btn.addEventListener('click', () => { closeModal(); startPomodoro(actId, parseInt(btn.dataset.min)); }));
  const display = document.getElementById('timeDisplay');
  const updateDisplay = () => { display.textContent = val.toFixed(1); };
  document.getElementById('btnApplyPrecise')?.addEventListener('click', () => {
    const inp = document.getElementById('preciseInput');
    const parsed = parseHMM(inp.value);
    if (parsed !== null && parsed >= 0) { val = Math.min(24, parsed); updateDisplay(); inp.value = ''; }
    else showToast('格式错误，请输入如 1:30 或 1.5');
  });
  document.getElementById('btnClearTime').addEventListener('click', () => { val=0; updateDisplay(); });
  document.querySelectorAll('.btn-quick-lg').forEach(btn => btn.addEventListener('click', () => { val=Math.min(24,(val||0)+parseFloat(btn.dataset.val)); updateDisplay(); }));
  document.getElementById('btnSaveTime').addEventListener('click', () => {
    if (isNaN(val)||val<0) { showToast('请输入有效时间'); return; }
    const prevHours = entry ? entry.hours : 0;
    setLogEntry(today, actId, val); save(); closeModal(); renderTab(state.tab);
    const justMet = target>0 && val>=target && prevHours<target;
    showToast(justMet ? `🎉 ${act.short} 目标达成！` : `已记录 ${val.toFixed(1)}h`);
  });
  document.getElementById('btnDeleteTime')?.addEventListener('click', () => { setLogEntry(today,actId,0); save(); closeModal(); renderTab(state.tab); showToast('记录已删除'); });
}

// ===================== NOTE MODAL =====================
function openNoteModal() {
  const today = todayStr();
  const current = state.notes[today] || '';
  openModal(`
    <div class="modal-title">💬 今日随记</div>
    <textarea class="notes-textarea" id="noteTextarea" maxlength="200" placeholder="记录今天的感受、反思或收获...">${current}</textarea>
    <div style="text-align:right;font-size:12px;color:var(--text3);margin-bottom:12px" id="noteCharCount">${current.length}/200</div>
    <button class="btn-save" id="btnSaveNote">保存</button>
    ${current ? `<button class="btn-delete" id="btnClearNote">清除随记</button>` : ''}
  `);
  const ta = document.getElementById('noteTextarea');
  const cc = document.getElementById('noteCharCount');
  ta.addEventListener('input', () => { cc.textContent = `${ta.value.length}/200`; });
  document.getElementById('btnSaveNote').addEventListener('click', () => {
    const text = ta.value.trim();
    if (text) state.notes[today] = text; else delete state.notes[today];
    save(); closeModal(); renderTab(state.tab); showToast('随记已保存');
  });
  document.getElementById('btnClearNote')?.addEventListener('click', () => {
    delete state.notes[today]; save(); closeModal(); renderTab(state.tab); showToast('随记已清除');
  });
}

// ===================== ACTIVITY DETAIL MODAL =====================
function openActivityDetailModal(actId) {
  const act = getActivityById(actId); if (!act) return;
  const today = todayStr();
  const days30 = Array.from({length:30}, (_,i) => {
    const d = addDays(today, -29+i);
    const e = getLogEntry(d, actId);
    return { date: d, hours: e ? e.hours : 0 };
  });
  const totalAllTime = Object.values(state.logs).flat().filter(e => e.activityId === actId).reduce((s,e) => s+(e.hours||0), 0);
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${pad2(now.getMonth()+1)}`;
  const monthTotal = Object.entries(state.logs).filter(([d]) => d.startsWith(monthStr)).flatMap(([,es]) => es).filter(e => e.activityId === actId).reduce((s,e) => s+(e.hours||0), 0);
  const actStreak = getActivityStreak(actId);
  destroyChart();
  openModal(`
    <div class="act-detail-header" style="background:${act.color}22;border-left:4px solid ${act.color};padding:12px 16px;border-radius:8px;margin-bottom:12px">
      <div style="font-size:22px">${act.emoji}</div>
      <div style="font-size:16px;font-weight:700;color:var(--text1)">${act.name}</div>
    </div>
    <div class="act-detail-stats">
      <div class="act-stat"><div class="act-stat-val">${totalAllTime.toFixed(1)}</div><div class="act-stat-label">累计(h)</div></div>
      <div class="act-stat"><div class="act-stat-val">${monthTotal.toFixed(1)}</div><div class="act-stat-label">本月(h)</div></div>
      <div class="act-stat"><div class="act-stat-val">${actStreak}</div><div class="act-stat-label">连续天</div></div>
    </div>
    <div class="act-chart-wrap"><canvas id="actDetailCanvas" height="120"></canvas></div>
  `);
  requestAnimationFrame(() => {
    const canvas = document.getElementById('actDetailCanvas'); if (!canvas) return;
    const labels = days30.map(d => { const dd = new Date(d.date+'T00:00:00'); return `${dd.getMonth()+1}/${dd.getDate()}`; });
    state.chart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ data: days30.map(d=>d.hours), backgroundColor: act.color+'99', borderColor: act.color, borderWidth:1, borderRadius:3 }] },
      options: { plugins:{legend:{display:false}}, scales:{ x:{ticks:{maxRotation:0,font:{size:9}},grid:{display:false}}, y:{ticks:{font:{size:9}},beginAtZero:true} }, animation:{duration:400} }
    });
  });
}

// ===================== EDIT ACTIVITY MODAL =====================
function openEditActivityModal(actId) {
  const act = getActivityById(actId); if (!act) return;
  let selEmoji = act.emoji, selColor = act.color;
  const activeDaysArr = act.activeDays || [0,1,2,3,4,5,6];
  let selDays = new Set(activeDaysArr);
  const dayLabels = ['日','一','二','三','四','五','六'];
  openModal(`
    <div class="modal-title">编辑活动</div>
    <div class="time-label" style="margin-bottom:8px">活动名称</div>
    <input class="text-input" id="actNameInput" value="${act.name}" maxlength="30">
    <div class="time-label" style="margin-bottom:8px">每日目标时长（小时，0表示不设目标）</div>
    <input class="text-input" id="actTargetInput" type="number" value="${act.targetHours||0}" min="0" max="24" step="0.5" placeholder="0">
    <div class="time-label" style="margin-bottom:8px">目标生效日</div>
    <div class="active-days-picker">${dayLabels.map((d,i)=>`<button class="active-days-btn${selDays.has(i)?' active':''}" data-dow="${i}">${d}</button>`).join('')}</div>
    <div class="time-label" style="margin-bottom:8px">分组名称（可选）</div>
    <input class="text-input" id="actGroupInput" value="${act.group||''}" maxlength="20" placeholder="如：学习、运动...">
    <div class="time-label" style="margin-bottom:8px">选择图标</div>
    <div class="emoji-picker">${EMOJIS.map(e=>`<button class="emoji-option ${e===selEmoji?'selected':''}" data-emoji="${e}">${e}</button>`).join('')}</div>
    <div class="time-label" style="margin-bottom:8px">选择颜色</div>
    <div class="color-picker">${COLORS.map(c=>`<div class="color-option ${c===selColor?'selected':''}" data-color="${c}" style="background:${c}"></div>`).join('')}</div>
    <button class="btn-save" id="btnSaveEdit">保存修改</button>
    <button class="btn-delete" id="btnDeleteAct">删除活动</button>
  `);
  document.querySelectorAll('.active-days-btn').forEach(btn => btn.addEventListener('click', () => {
    const dow = parseInt(btn.dataset.dow);
    if (selDays.has(dow)) selDays.delete(dow); else selDays.add(dow);
    btn.classList.toggle('active', selDays.has(dow));
  }));
  document.querySelectorAll('.emoji-option').forEach(btn => btn.addEventListener('click', () => { selEmoji=btn.dataset.emoji; document.querySelectorAll('.emoji-option').forEach(b=>b.classList.toggle('selected',b.dataset.emoji===selEmoji)); }));
  document.querySelectorAll('.color-option').forEach(el => el.addEventListener('click', () => { selColor=el.dataset.color; document.querySelectorAll('.color-option').forEach(b=>b.classList.toggle('selected',b.dataset.color===selColor)); }));
  document.getElementById('btnSaveEdit').addEventListener('click', () => {
    const name = document.getElementById('actNameInput').value.trim();
    const target = parseFloat(document.getElementById('actTargetInput').value)||0;
    if (!name) { showToast('请输入活动名称'); return; }
    act.name = name;
    act.short = name.length>8 ? name.slice(0,8)+'...' : name;
    act.emoji = selEmoji; act.color = selColor;
    act.targetHours = Math.max(0, target);
    act.activeDays = selDays.size === 7 ? null : [...selDays].sort((a,b)=>a-b);
    act.group = document.getElementById('actGroupInput').value.trim();
    save(); closeModal(); renderTab(state.tab); showToast('活动已更新');
  });
  document.getElementById('btnDeleteAct').addEventListener('click', () => {
    healthConfirm(`确定删除「${act.name}」吗？<br><small style="color:var(--text3)">历史打卡记录会保留</small>`, () => {
      state.activities = state.activities.filter(a => a.id !== actId);
      save(); closeModal(); renderTab(state.tab); showToast('活动已删除');
    }, '删除');
  });
}

// ===================== ADD ACTIVITY MODAL =====================
function openAddActivityModal() {
  let selEmoji='🎯', selColor=COLORS[0];
  openModal(`
    <div class="modal-title">添加新活动</div>
    <div class="time-label" style="margin-bottom:8px">活动名称</div>
    <input class="text-input" id="actNameInput" placeholder="输入活动名称..." maxlength="30">
    <div class="time-label" style="margin-bottom:8px">每日目标时长（小时，0表示不设目标）</div>
    <input class="text-input" id="actTargetInput" type="number" value="1" min="0" max="24" step="0.5">
    <div class="time-label" style="margin-bottom:8px">选择图标</div>
    <div class="emoji-picker">${EMOJIS.map(e=>`<button class="emoji-option ${e===selEmoji?'selected':''}" data-emoji="${e}">${e}</button>`).join('')}</div>
    <div class="time-label" style="margin-bottom:8px">选择颜色</div>
    <div class="color-picker">${COLORS.map(c=>`<div class="color-option ${c===selColor?'selected':''}" data-color="${c}" style="background:${c}"></div>`).join('')}</div>
    <button class="btn-save" id="btnSaveActivity">添加活动</button>
  `);
  document.querySelectorAll('.emoji-option').forEach(btn => btn.addEventListener('click', () => { selEmoji=btn.dataset.emoji; document.querySelectorAll('.emoji-option').forEach(b=>b.classList.toggle('selected',b.dataset.emoji===selEmoji)); }));
  document.querySelectorAll('.color-option').forEach(el => el.addEventListener('click', () => { selColor=el.dataset.color; document.querySelectorAll('.color-option').forEach(b=>b.classList.toggle('selected',b.dataset.color===selColor)); }));
  document.getElementById('btnSaveActivity').addEventListener('click', () => {
    const name = document.getElementById('actNameInput').value.trim();
    const target = parseFloat(document.getElementById('actTargetInput').value)||0;
    if (!name) { showToast('请输入活动名称'); return; }
    state.activities.push({ id:'a_'+Date.now(), name, short:name.length>8?name.slice(0,8)+'...':name, emoji:selEmoji, color:selColor, targetHours:Math.max(0,target), activeDays:null, group:'' });
    save(); closeModal(); renderTab('checkin'); showToast('活动已添加');
  });
}

// ===================== MANAGE ACTIVITIES MODAL =====================
function openManageActivitiesModal() {
  openModal(`
    <div class="modal-title">管理活动</div>
    <div style="display:flex;flex-direction:column;gap:8px;" id="manageList">
      ${state.activities.map((a,i) => `
        <div class="manage-act-row">
          <div class="manage-act-reorder">
            <button class="btn-reorder" data-idx="${i}" data-dir="up" ${i===0?'disabled':''}>▲</button>
            <button class="btn-reorder" data-idx="${i}" data-dir="down" ${i===state.activities.length-1?'disabled':''}>▼</button>
          </div>
          <span style="font-size:20px">${a.emoji}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600;color:#1C1C1E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name}</div>
            <div style="font-size:11px;color:#8E8E93">${a.targetHours>0?'目标: '+a.targetHours+'h/天':'无目标'}</div>
          </div>
          <button class="btn-edit-act" data-id="${a.id}" style="width:32px;height:32px;border-radius:8px;background:#F2F2F7;font-size:14px">✏️</button>
        </div>`).join('')}
    </div>
    <button class="btn-save" style="margin-top:16px" id="btnAddFromManage">＋ 添加新活动</button>
  `);
  document.querySelectorAll('.btn-reorder').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx), dir = btn.dataset.dir;
      if (dir==='up' && idx>0) { [state.activities[idx-1],state.activities[idx]] = [state.activities[idx],state.activities[idx-1]]; }
      else if (dir==='down' && idx<state.activities.length-1) { [state.activities[idx],state.activities[idx+1]] = [state.activities[idx+1],state.activities[idx]]; }
      save(); openManageActivitiesModal();
    });
  });
  document.querySelectorAll('.btn-edit-act').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(); setTimeout(() => openEditActivityModal(btn.dataset.id), 250); });
  });
  document.getElementById('btnAddFromManage')?.addEventListener('click', () => { closeModal(); setTimeout(openAddActivityModal, 250); });
}

// ===================== WEEKLY REVIEW MODAL =====================
function openWeeklyReviewModal() {
  const today = todayStr();
  let weekTotal=0, bestH=0;
  const actTotals = {};
  for (let i=0; i<7; i++) {
    const d = addDays(today,-i);
    const logs = getLogsForDate(d);
    const dh = logs.reduce((s,e)=>s+e.hours,0);
    weekTotal += dh;
    if (dh > bestH) bestH=dh;
    logs.forEach(e => { actTotals[e.activityId] = (actTotals[e.activityId]||0)+e.hours; });
  }
  const activeDaysCount = Array.from({length:7},(_,i)=>addDays(today,-i)).filter(d => getTotalHoursForDate(d)>0).length;
  const topActs = Object.entries(actTotals).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const avgH = activeDaysCount > 0 ? weekTotal/activeDaysCount : 0;
  openModal(`
    <div class="modal-title">📊 本周复盘</div>
    <div class="review-stats-grid">
      <div class="review-stat"><div class="review-stat-val">${weekTotal.toFixed(1)}</div><div class="review-stat-label">本周总时长(h)</div></div>
      <div class="review-stat"><div class="review-stat-val">${activeDaysCount}/7</div><div class="review-stat-label">活跃天数</div></div>
      <div class="review-stat"><div class="review-stat-val">${avgH.toFixed(1)}</div><div class="review-stat-label">日均时长(h)</div></div>
      <div class="review-stat"><div class="review-stat-val">${bestH>0?bestH.toFixed(1):'-'}</div><div class="review-stat-label">最高单日(h)</div></div>
    </div>
    ${topActs.length>0 ? `<div class="time-label" style="margin:16px 0 10px">本周投入最多</div>${topActs.map(([id,h]) => { const act=getActivityById(id); if(!act)return ''; return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F2F2F7"><span style="font-size:18px">${act.emoji}</span><span style="flex:1;font-size:14px;font-weight:500;color:#1C1C1E">${act.short}</span><span style="font-size:14px;font-weight:700;color:${act.color}">${h.toFixed(1)}h</span></div>`; }).join('')}` : ''}
    <div class="review-summary">${weekTotal>=40?'🔥 本周投入超过40小时，状态极佳！':weekTotal>=20?'💪 本周稳扎稳打，继续保持！':weekTotal>0?'📈 下周继续努力，坚持是关键！':'💡 本周记录较少，下周加油！'}</div>
  `);
}

// ===================== PROFILE MODALS =====================
const AVATAR_OPTIONS = ['🧑','👩','👨','🧒','👧','👦','🧑‍💻','👩‍💻','🦸','🧑‍🎨','🐱','🐶'];

function openProfileSetupModal() {
  let selAvatar = '🧑';
  document.getElementById('modalBackdrop').removeEventListener('click', closeModal);
  openModal(`
    <div class="setup-hero">
      <div class="setup-hero-icon">🌟</div>
      <div class="setup-hero-title">欢迎使用健康打卡</div>
      <div class="setup-hero-sub">先设置一下你的个人资料吧</div>
    </div>
    <div class="time-label" style="margin-bottom:8px">你的名字</div>
    <input class="text-input" id="profileNameInput" placeholder="请输入你的名字..." maxlength="20" style="margin-bottom:16px">
    <div class="time-label" style="margin-bottom:8px">选择头像</div>
    <div class="emoji-picker" style="margin-bottom:24px">${AVATAR_OPTIONS.map(e=>`<button class="emoji-option ${e===selAvatar?'selected':''}" data-emoji="${e}">${e}</button>`).join('')}</div>
    <button class="btn-save" id="btnConfirmProfile">开始使用 →</button>
  `);
  document.querySelectorAll('.emoji-option').forEach(btn => btn.addEventListener('click', () => {
    selAvatar = btn.dataset.emoji;
    document.querySelectorAll('.emoji-option').forEach(b => b.classList.toggle('selected', b.dataset.emoji===selAvatar));
  }));
  document.getElementById('btnConfirmProfile').addEventListener('click', () => {
    const name = document.getElementById('profileNameInput').value.trim();
    if (!name) { showToast('请输入你的名字'); return; }
    state.profile = { name, avatar: selAvatar };
    save();
    document.getElementById('modalBackdrop').addEventListener('click', closeModal);
    closeModal();
    showToast(`欢迎，${name}！🎉`);
    renderTab(state.tab);
  });
}

function openEditProfileModal() {
  let selAvatar = state.profile.avatar || '🧑';
  openModal(`
    <div class="modal-title">编辑个人资料</div>
    <div class="time-label" style="margin-bottom:8px">你的名字</div>
    <input class="text-input" id="profileNameInput" value="${state.profile.name||''}" maxlength="20" style="margin-bottom:16px">
    <div class="time-label" style="margin-bottom:8px">选择头像</div>
    <div class="emoji-picker" style="margin-bottom:24px">${AVATAR_OPTIONS.map(e=>`<button class="emoji-option ${e===selAvatar?'selected':''}" data-emoji="${e}">${e}</button>`).join('')}</div>
    <button class="btn-save" id="btnSaveProfile">保存</button>
  `);
  document.querySelectorAll('.emoji-option').forEach(btn => btn.addEventListener('click', () => {
    selAvatar = btn.dataset.emoji;
    document.querySelectorAll('.emoji-option').forEach(b => b.classList.toggle('selected', b.dataset.emoji===selAvatar));
  }));
  document.getElementById('btnSaveProfile').addEventListener('click', () => {
    const name = document.getElementById('profileNameInput').value.trim();
    if (!name) { showToast('请输入你的名字'); return; }
    state.profile = { name, avatar: selAvatar };
    save(); closeModal(); showToast('资料已更新');
  });
}

// ===================== DATA IMPORT / EXPORT =====================
function applyImportMerge(data) {
  data.activities.forEach(a => { if (!state.activities.find(x => x.id === a.id)) state.activities.push(a); });
  Object.entries(data.logs).forEach(([date, entries]) => {
    if (!state.logs[date]) state.logs[date] = [];
    entries.forEach(e => {
      const idx = state.logs[date].findIndex(x => x.activityId === e.activityId);
      if (idx < 0) state.logs[date].push(e);
      else state.logs[date][idx].hours = Math.max(state.logs[date][idx].hours, e.hours);
    });
  });
  save(); renderTab(state.tab); showToast('✅ 已合并导入');
}
function applyImportReplace(data) {
  state.activities = data.activities;
  state.logs = data.logs;
  if (data.profile) state.profile = data.profile;
  save(); renderTab(state.tab); showToast('✅ 已替换导入');
}
function showImportChoiceSheet(data) {
  const sheet = document.createElement('div');
  sheet.className = 'health-confirm-overlay';
  sheet.innerHTML = `
    <div class="health-confirm-sheet">
      <div class="health-confirm-msg">选择导入方式</div>
      <div class="import-choice-list">
        <button class="import-choice-btn" id="impMerge">
          <b>合并导入</b><small>保留现有数据，补充文件中的新记录（推荐）</small>
        </button>
        <button class="import-choice-btn danger" id="impReplace">
          <b>替换导入</b><small>清空现有数据，完全使用文件内容</small>
        </button>
        <button class="health-confirm-cancel" id="impCancel" style="width:100%;margin-top:4px">取消</button>
      </div>
    </div>`;
  document.body.appendChild(sheet);
  const remove = () => { if (document.body.contains(sheet)) document.body.removeChild(sheet); };
  sheet.querySelector('#impCancel').addEventListener('click', remove);
  sheet.querySelector('#impMerge').addEventListener('click', () => { remove(); applyImportMerge(data); });
  sheet.querySelector('#impReplace').addEventListener('click', () => {
    remove();
    healthConfirm('替换导入会<b style="color:var(--danger)">清空现有全部打卡数据</b>，确定继续吗？', () => applyImportReplace(data), '清空并替换');
  });
}
function importPlannerData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      let data;
      try { data = JSON.parse(e.target.result); } catch { showToast('❌ 文件格式错误'); return; }
      if (!data.activities || !data.logs) { showToast('❌ 数据格式不符'); return; }
      // 三选项导入弹层：合并 / 替换（危险）/ 取消，替换需二次确认
      showImportChoiceSheet(data);
    };
    reader.readAsText(file);
  });
  input.click();
}

function exportPlannerData() {
  const data = { activities: state.activities, logs: state.logs, profile: state.profile, exportTime: new Date().toISOString(), version: '1.0' };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `planner-data-${todayStr()}.json`;
  a.click(); URL.revokeObjectURL(url);
  showToast('数据已导出');
}

// ===================== SHARE =====================
function shareDay() {
  const logs = getLogsForDate(state.date).sort((a,b)=>b.hours-a.hours);
  const total = logs.reduce((s,e)=>s+e.hours,0);
  if (total===0) { showToast('今日暂无记录'); return; }
  const text = `📊 ${formatDate(state.date)} 我的时间投入\n总计: ${total.toFixed(1)}h\n${logs.map(e=>{const act=getActivityById(e.activityId);return act?`${act.emoji} ${act.short}: ${e.hours.toFixed(1)}h`:''}).filter(Boolean).join('\n')}\n\n#个人规划 #时间管理`;
  if (navigator.share) navigator.share({text}).catch(()=>copyToClipboard(text));
  else copyToClipboard(text);
}
function copyToClipboard(text) { navigator.clipboard.writeText(text).then(()=>showToast('已复制到剪贴板 ✓')).catch(()=>showToast('分享失败')); }

// ===================== TAB ROUTING =====================
function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.seg-btn[data-tab]').forEach(el => el.classList.toggle('active', el.dataset.tab===tab));
  const names = {analytics:'数据分析', checkin:'今日打卡', achievements:'成就收藏'};
  const brandEl = document.getElementById('brandPage');
  if (brandEl) brandEl.textContent = names[tab] || tab;
  const ha = document.getElementById('headerActions');
  if (ha) ha.style.display = (tab==='analytics') ? 'flex' : 'none';
  renderTab(tab);
}
function renderTab(tab) {
  destroyChart();
  const main = document.getElementById('appMain');
  if (!main) return;
  main.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'tab-content';
  if (tab==='analytics')         renderAnalytics(wrap);
  else if (tab==='checkin')      renderCheckin(wrap);
  else if (tab==='achievements') renderAchievements(wrap);
  main.appendChild(wrap);
}

// ===================== PLANNER INIT (called by app.js) =====================
function plannerInit() {
  document.getElementById('btnReview')?.addEventListener('click', openWeeklyReviewModal);
  const pill = document.getElementById('timerPill');
  if (pill) pill.addEventListener('click', () => switchTab('checkin'));
  switchTab(state.tab || 'checkin');
  if (!state.profile.name) {
    setTimeout(openProfileSetupModal, 350);
  }
}
