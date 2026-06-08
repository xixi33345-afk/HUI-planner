'use strict';
// ===================== AI HEALTH PLAN GENERATOR =====================
// Flow: fill profile → generate prompt → user copies to free AI
//       → user pastes result back → parse → save to localStorage

// ---- Wizard state ----
let _aiStep = 1;
let _aiData = {};       // form data from step 1
let _aiParsed = null;   // parseAIPlan() result before confirm

// ===================== STORAGE =====================
function aiPlanLoad() {
  try { return JSON.parse(localStorage.getItem('app_ai_plan') || 'null'); } catch { return null; }
}

function aiPlanSave(plan) {
  localStorage.setItem('app_ai_plan', JSON.stringify(plan));
  window.app?.onDataChanged?.('health');
}

// ===================== PROMPT GENERATION =====================
function generateHealthPrompt(d) {
  const bmi = d.height && d.currentWeight
    ? (d.currentWeight / Math.pow(d.height / 100, 2)).toFixed(1)
    : '未知';
  const genderText = d.gender === 'male' ? '男' : d.gender === 'female' ? '女' : '其他';
  const goalText = { lose: '减脂', gain: '增肌', maintain: '维持体型' }[d.goal] || '健康管理';
  const goalWeightLine = d.goalWeight ? `\n- 目标体重：${d.goalWeight}kg` : '';

  return `你是一位专业营养师和健身教练，请为我制定一份个性化的健康计划。

【个人信息】
- 性别：${genderText}，${d.age || '未知'}岁
- 身高：${d.height || '未知'}cm，体重：${d.currentWeight || '未知'}kg，BMI：${bmi}${goalWeightLine}
- 目标：${goalText}
- 饮食偏好：${d.dietPref || '无特殊要求'}
- 每周运动次数：${d.exerciseFreq || 3}次
- 特殊限制：${d.restrictions || '无'}
- 计划周期：${d.durationWeeks || 4}周

【输出要求】
请严格按照以下格式输出，不要添加其他任何内容：

===计划概述===
（用2-3句话描述整体方案思路）

===每日饮食===
早餐：[具体食物] [热量]kcal
午餐：[具体食物] [热量]kcal
晚餐：[具体食物] [热量]kcal
加餐：[具体食物] [热量]kcal
每日总热量目标：[数字]kcal

===运动计划===
[星期一]：[运动名称] [时长]分钟 [消耗热量]kcal
[星期二]：休息日
[星期三]：[运动名称] [时长]分钟 [消耗热量]kcal
[星期四]：[运动名称] [时长]分钟 [消耗热量]kcal
[星期五]：休息日
[星期六]：[运动名称] [时长]分钟 [消耗热量]kcal
[星期日]：休息日

===每周习惯===
- [具体可执行的习惯任务]
- [具体可执行的习惯任务]
（共5-8条）

===注意事项===
（3-5条重要提醒）

===END===`;
}

// ===================== PARSING =====================
function parseAIPlan(rawText) {
  const plan = {
    overview: '',
    dailyDiet: { breakfast: '', lunch: '', dinner: '', snack: '', totalCalories: 0 },
    weeklyExercise: {},
    weeklyTasks: [],
    notes: [],
    raw: rawText,
    createdAt: new Date().toISOString(),
    isValid: false,
    error: null
  };

  if (!rawText || rawText.trim().length < 50) {
    plan.error = '内容太短，请确保粘贴了完整的AI回复';
    return plan;
  }
  if (!rawText.includes('===END===') && !rawText.includes('=== END ===')) {
    plan.error = '回复不完整（未找到===END===），请确认完整复制了AI的全部回复';
  }

  function extractSection(text, name) {
    const re = new RegExp(`===\\s*${name}\\s*===([\\s\\S]*?)(?====|$)`);
    const m = text.match(re);
    return m ? m[1].trim() : '';
  }

  // Overview
  plan.overview = extractSection(rawText, '计划概述');

  // Diet
  const dietText = extractSection(rawText, '每日饮食');
  if (dietText) {
    [
      { key: 'breakfast', re: /早餐[：:]\s*(.+)/ },
      { key: 'lunch',     re: /午餐[：:]\s*(.+)/ },
      { key: 'dinner',    re: /晚餐[：:]\s*(.+)/ },
      { key: 'snack',     re: /加餐[：:]\s*(.+)/ },
    ].forEach(({ key, re }) => {
      const m = dietText.match(re);
      if (m) plan.dailyDiet[key] = m[1].trim();
    });
    const cm = dietText.match(/总热量目标[：:]\s*(\d+)/);
    if (cm) plan.dailyDiet.totalCalories = parseInt(cm[1]);
  }

  // Exercise (weekly schedule)
  const exText = extractSection(rawText, '运动计划');
  if (exText) {
    const days = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
    exText.split('\n').forEach(line => {
      days.forEach(day => {
        if (line.includes(`[${day}]`) || line.includes(`${day}：`) || line.includes(`${day}:`)) {
          if (/休息/.test(line)) {
            plan.weeklyExercise[day] = { name: '休息日', duration: 0, calories: 0 };
          } else {
            const dm  = line.match(/(\d+)\s*分钟/);
            const cm2 = line.match(/(\d+)\s*kcal/i);
            const nm  = line.match(/[:\]：]\s*([^\d\[\]，,。\n]+?)\s+\d/);
            plan.weeklyExercise[day] = {
              name:     nm   ? nm[1].trim()      : '运动',
              duration: dm   ? parseInt(dm[1])   : 30,
              calories: cm2  ? parseInt(cm2[1])  : 0
            };
          }
        }
      });
    });
  }

  // Weekly habits (try both section names)
  const tasksText = extractSection(rawText, '每周习惯') || extractSection(rawText, '每周任务');
  if (tasksText) {
    plan.weeklyTasks = tasksText.split('\n')
      .map(l => l.replace(/^[\-•·*\d.、]\s*/, '').trim())
      .filter(l => l.length > 2);
  }

  // Notes
  const notesText = extractSection(rawText, '注意事项');
  if (notesText) {
    plan.notes = notesText.split('\n')
      .map(l => l.replace(/^[\-•·*\d.、]\s*/, '').trim())
      .filter(l => l.length > 2);
  }

  plan.isValid =
    plan.overview.length > 5 ||
    Object.keys(plan.weeklyExercise).length > 0 ||
    plan.weeklyTasks.length > 0;

  if (!plan.isValid && !plan.error) {
    plan.error = '未能解析出有效内容，请检查AI是否严格按格式回复';
  }
  return plan;
}

// ===================== WIZARD ENTRY POINTS =====================
function openAIPlanWizard() {
  _aiStep = 1;
  _aiData = {};
  _aiParsed = null;
  _aiEnsureOverlay();
  _aiRenderStep(1);
}

function viewAIPlan() {
  const plan = aiPlanLoad();
  if (!plan) { openAIPlanWizard(); return; }
  _aiEnsureOverlay();
  _aiRenderPlanView(plan);
}

function closeAIPlanWizard() {
  const ov = document.getElementById('aiPlanOverlay');
  if (ov) ov.classList.remove('show');
}

// ===================== WIZARD INTERNALS =====================
function _aiEnsureOverlay() {
  let ov = document.getElementById('aiPlanOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'aiPlanOverlay';
    document.body.appendChild(ov);
  }
  ov.classList.add('show');
}

function _aiRenderStep(step) {
  _aiStep = step;
  const ov = document.getElementById('aiPlanOverlay');
  if (!ov) return;

  const isLastStep = step === 5;
  const isFirstStep = step === 1;
  const backAction = (isFirstStep || isLastStep) ? 'closeAIPlanWizard()' : `_aiRenderStep(${step - 1})`;
  const backLabel  = (isFirstStep || isLastStep) ? '✕ 关闭' : '‹ 返回';
  const stepLabel  = isLastStep ? '' : `${step} / 4`;

  const bodyFns = [null, _aiStep1, _aiStep2, _aiStep3, _aiStep4, _aiStep5];
  const body = bodyFns[step]();

  ov.innerHTML = `
    <div class="ai-wizard-sheet">
      <div class="ai-wizard-header">
        <button class="ai-wizard-nav-btn" onclick="${backAction}">${backLabel}</button>
        <span class="ai-wizard-title">✨ AI 健康计划</span>
        <span class="ai-wizard-steps">${stepLabel}</span>
      </div>
      <div class="ai-wizard-body">${body}</div>
    </div>`;
}

// ---- Step 1: Profile form ----
function _aiStep1() {
  const hp     = (typeof healthData !== 'undefined') ? (healthData.profile || {}) : {};
  const goals  = (typeof healthData !== 'undefined') ? (healthData.goals   || {}) : {};
  const latestW = (typeof healthGetLatestWeight === 'function') ? healthGetLatestWeight() : null;
  const d = _aiData;

  const height        = d.height        !== undefined ? d.height        : (hp.height       || '');
  const age           = d.age           !== undefined ? d.age           : (hp.age          || '');
  const gender        = d.gender        !== undefined ? d.gender        : (hp.gender       || 'female');
  const currentWeight = d.currentWeight !== undefined ? d.currentWeight : (latestW ? latestW.weight : '');
  const goalWeight    = d.goalWeight    !== undefined ? d.goalWeight    : (goals.weight    || '');
  const goal          = d.goal          || 'lose';
  const dietPref      = d.dietPref      || '无特殊要求';
  const exerciseFreq  = d.exerciseFreq  !== undefined ? d.exerciseFreq  : 3;
  const durationWeeks = d.durationWeeks !== undefined ? d.durationWeeks : 4;
  const restrictions  = d.restrictions  || '';

  const goalOpts = [
    { val: 'lose',     label: '减脂' },
    { val: 'gain',     label: '增肌' },
    { val: 'maintain', label: '维持体型' },
  ];
  const dietOpts = [
    { val: '无特殊要求', label: '无限制' },
    { val: '素食',      label: '素食' },
    { val: '低碳水',    label: '低碳水' },
    { val: '低脂',      label: '低脂' },
  ];

  return `
    <div class="ai-step-title">告诉我你的基本情况</div>
    <div class="ai-step-desc">已从健康档案自动填入，请确认并补充</div>

    <div class="ai-form-group">
      <label class="ai-form-label">我的目标</label>
      <div class="ai-chips" id="aiGoalChips">
        ${goalOpts.map(o =>
          `<button class="ai-chip${goal === o.val ? ' active' : ''}" data-val="${o.val}" onclick="_aiPickChip('goal','${o.val}','#aiGoalChips')">${o.label}</button>`
        ).join('')}
      </div>
    </div>

    <div class="ai-form-row">
      <div class="ai-form-group half">
        <label class="ai-form-label">性别</label>
        <select id="aiGender" class="text-input">
          <option value="female" ${gender === 'female' ? 'selected' : ''}>女</option>
          <option value="male"   ${gender === 'male'   ? 'selected' : ''}>男</option>
          <option value="other"  ${gender === 'other'  ? 'selected' : ''}>其他</option>
        </select>
      </div>
      <div class="ai-form-group half">
        <label class="ai-form-label">年龄</label>
        <input type="number" id="aiAge" class="text-input" value="${age}" placeholder="岁" min="10" max="100">
      </div>
    </div>

    <div class="ai-form-row">
      <div class="ai-form-group half">
        <label class="ai-form-label">身高 (cm)</label>
        <input type="number" id="aiHeight" class="text-input" value="${height}" placeholder="cm" min="100" max="250">
      </div>
      <div class="ai-form-group half">
        <label class="ai-form-label">当前体重 (kg)</label>
        <input type="number" id="aiCurrentWeight" class="text-input" value="${currentWeight}" placeholder="kg" step="0.1">
      </div>
    </div>

    <div class="ai-form-group">
      <label class="ai-form-label">目标体重 kg（选填）</label>
      <input type="number" id="aiGoalWeight" class="text-input" value="${goalWeight}" placeholder="如：55" step="0.1">
    </div>

    <div class="ai-form-group">
      <label class="ai-form-label">饮食偏好</label>
      <div class="ai-chips" id="aiDietChips">
        ${dietOpts.map(o =>
          `<button class="ai-chip${dietPref === o.val ? ' active' : ''}" data-val="${o.val}" onclick="_aiPickChip('dietPref','${o.val}','#aiDietChips')">${o.label}</button>`
        ).join('')}
      </div>
    </div>

    <div class="ai-form-row">
      <div class="ai-form-group half">
        <label class="ai-form-label">每周运动次数</label>
        <select id="aiExerciseFreq" class="text-input">
          ${[1,2,3,4,5,6,7].map(n =>
            `<option value="${n}" ${exerciseFreq == n ? 'selected' : ''}>${n}次</option>`
          ).join('')}
        </select>
      </div>
      <div class="ai-form-group half">
        <label class="ai-form-label">计划周期</label>
        <select id="aiDurationWeeks" class="text-input">
          ${[2,4,6,8,12].map(n =>
            `<option value="${n}" ${durationWeeks == n ? 'selected' : ''}>${n}周</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <div class="ai-form-group">
      <label class="ai-form-label">特殊限制（过敏、伤病等，选填）</label>
      <input type="text" id="aiRestrictions" class="text-input" value="${restrictions}" placeholder="如：乳糖不耐受、膝盖受伤">
    </div>

    <button class="btn-save ai-next-btn" onclick="_aiStep1Next()">生成提示词 →</button>`;
}

function _aiPickChip(field, val, selector) {
  _aiData[field] = val;
  document.querySelectorAll(`${selector} .ai-chip`).forEach(b =>
    b.classList.toggle('active', b.dataset.val === val)
  );
}

function _aiStep1Next() {
  _aiData.goal          = _aiData.goal     || 'lose';
  _aiData.dietPref      = _aiData.dietPref || '无特殊要求';
  _aiData.gender        = document.getElementById('aiGender')?.value        || 'female';
  _aiData.age           = parseInt(document.getElementById('aiAge')?.value)                  || null;
  _aiData.height        = parseFloat(document.getElementById('aiHeight')?.value)             || null;
  _aiData.currentWeight = parseFloat(document.getElementById('aiCurrentWeight')?.value)      || null;
  _aiData.goalWeight    = parseFloat(document.getElementById('aiGoalWeight')?.value)         || null;
  _aiData.exerciseFreq  = parseInt(document.getElementById('aiExerciseFreq')?.value)         || 3;
  _aiData.durationWeeks = parseInt(document.getElementById('aiDurationWeeks')?.value)        || 4;
  _aiData.restrictions  = document.getElementById('aiRestrictions')?.value                   || '';

  if (!_aiData.currentWeight) {
    healthShowToast('请填写当前体重');
    return;
  }
  _aiRenderStep(2);
}

// ---- Step 2: Generated prompt ----
function _aiStep2() {
  const prompt = generateHealthPrompt(_aiData);
  _aiData._prompt = prompt;

  return `
    <div class="ai-step-title">复制提示词，发给AI</div>
    <div class="ai-step-desc">复制下方提示词，打开任意免费AI发送，等待AI回复完整后回来粘贴</div>

    <div class="ai-tools-hint">
      <span>推荐工具：</span>
      <span class="ai-tool-badge">微信搜"元宝"</span>
      <span class="ai-tool-badge">doubao.com</span>
      <span class="ai-tool-badge">kimi.moonshot.cn</span>
    </div>

    <textarea class="ai-prompt-box" id="aiPromptText" readonly>${prompt}</textarea>

    <button class="btn-save ai-next-btn" id="btnCopyPrompt" onclick="aiCopyPrompt()">一键复制提示词</button>
    <div class="ai-copy-hint" id="aiCopyHint">已复制！请打开AI工具粘贴发送，等待完整回复后点击下方按钮</div>
    <button class="ai-next-btn-ghost" onclick="_aiRenderStep(3)">我已获得AI回复，下一步 →</button>`;
}

function aiCopyPrompt() {
  const text = document.getElementById('aiPromptText')?.value;
  if (!text) return;
  const success = () => {
    const btn = document.getElementById('btnCopyPrompt');
    if (btn) { btn.textContent = '✓ 已复制！'; btn.style.background = 'var(--success)'; }
    const hint = document.getElementById('aiCopyHint');
    if (hint) hint.classList.add('show');
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(success).catch(() => _aiFallbackCopy(text, success));
  } else {
    _aiFallbackCopy(text, success);
  }
}

function _aiFallbackCopy(text, callback) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); callback?.(); } catch(e) {}
  document.body.removeChild(ta);
}

// ---- Step 3: Paste result ----
function _aiStep3() {
  return `
    <div class="ai-step-title">粘贴AI的回复</div>
    <div class="ai-step-desc">将AI返回的完整内容粘贴到下方，包含从 ===计划概述=== 到 ===END=== 的全部文字</div>

    <textarea class="ai-paste-box" id="aiPasteText" placeholder="在这里粘贴AI的完整回复...">${_aiData._pastedText || ''}</textarea>

    <div class="ai-parse-error" id="aiParseError"></div>

    <button class="btn-save ai-next-btn" onclick="_aiStep3Parse()">解析并预览 →</button>`;
}

function _aiStep3Parse() {
  const text = document.getElementById('aiPasteText')?.value?.trim();
  const errEl = document.getElementById('aiParseError');
  if (!text) {
    if (errEl) { errEl.textContent = '请先粘贴AI的回复内容'; errEl.classList.add('show'); }
    return;
  }
  if (errEl) errEl.classList.remove('show');
  _aiData._pastedText = text;
  _aiParsed = parseAIPlan(text);
  _aiRenderStep(4);
}

// ---- Step 4: Preview & confirm ----
function _aiStep4() {
  const p = _aiParsed;
  if (!p) return '<div class="ai-step-desc" style="padding:24px 0">解析失败，请返回重试</div>';

  const dietRows = [
    p.dailyDiet.breakfast ? `早餐：${p.dailyDiet.breakfast}` : '',
    p.dailyDiet.lunch     ? `午餐：${p.dailyDiet.lunch}`     : '',
    p.dailyDiet.dinner    ? `晚餐：${p.dailyDiet.dinner}`    : '',
    p.dailyDiet.snack     ? `加餐：${p.dailyDiet.snack}`     : '',
    p.dailyDiet.totalCalories ? `目标热量：${p.dailyDiet.totalCalories} kcal/天` : '',
  ].filter(Boolean);

  const exerciseRows = Object.entries(p.weeklyExercise).map(([day, ex]) =>
    `<div class="ai-preview-row">
      <span>${day}</span>
      <span>${ex.name === '休息日' ? '休息日' : `${ex.name}  ${ex.duration}min`}</span>
    </div>`
  ).join('');

  const hasContent = p.overview || dietRows.length || exerciseRows || p.weeklyTasks.length;

  return `
    <div class="ai-step-title">${p.isValid ? '计划预览' : '解析遇到问题'}</div>
    ${p.error ? `<div class="ai-parse-error show">${p.error}</div>` : ''}
    ${!hasContent ? `<div class="ai-step-desc" style="color:var(--danger)">未解析到有效内容。请返回确认AI按格式回复，重新粘贴。</div>` : ''}

    ${p.overview ? `
    <div class="ai-preview-section">
      <div class="ai-preview-section-title">📋 计划概述</div>
      <div class="ai-preview-text">${p.overview}</div>
    </div>` : ''}

    ${dietRows.length ? `
    <div class="ai-preview-section">
      <div class="ai-preview-section-title">🍽️ 每日饮食</div>
      ${dietRows.map(t => `<div class="ai-preview-row-text">${t}</div>`).join('')}
    </div>` : ''}

    ${exerciseRows ? `
    <div class="ai-preview-section">
      <div class="ai-preview-section-title">🏃 运动计划</div>
      ${exerciseRows}
    </div>` : ''}

    ${p.weeklyTasks.length ? `
    <div class="ai-preview-section">
      <div class="ai-preview-section-title">✅ 每周习惯</div>
      ${p.weeklyTasks.map(t => `<div class="ai-preview-row-text">• ${t}</div>`).join('')}
    </div>` : ''}

    ${p.notes.length ? `
    <div class="ai-preview-section">
      <div class="ai-preview-section-title">⚠️ 注意事项</div>
      ${p.notes.map(t => `<div class="ai-preview-row-text">• ${t}</div>`).join('')}
    </div>` : ''}

    <div class="ai-confirm-row">
      <button class="ai-next-btn-ghost" onclick="_aiRenderStep(3)">重新粘贴</button>
      <button class="btn-save" style="flex:2" onclick="_aiStep4Confirm()">
        ${p.isValid ? '确认保存计划 ✓' : '强制保存（内容不完整）'}
      </button>
    </div>`;
}

function _aiStep4Confirm() {
  if (!_aiParsed) return;
  const plan = {
    ..._aiParsed,
    id: 'plan_' + Date.now(),
    userProfile: {
      goal:          _aiData.goal,
      gender:        _aiData.gender,
      age:           _aiData.age,
      height:        _aiData.height,
      currentWeight: _aiData.currentWeight,
      goalWeight:    _aiData.goalWeight,
      dietPref:      _aiData.dietPref,
      exerciseFreq:  _aiData.exerciseFreq,
      durationWeeks: _aiData.durationWeeks,
      restrictions:  _aiData.restrictions,
    }
  };
  aiPlanSave(plan);
  _aiRenderStep(5);
}

// ---- Step 5: Done ----
function _aiStep5() {
  return `
    <div class="ai-success-wrap">
      <div class="ai-success-icon">✨</div>
      <div class="ai-step-title">计划已保存！</div>
      <div class="ai-step-desc">你的专属健康计划已生成并保存到本地</div>
    </div>
    <div class="ai-success-actions">
      <button class="btn-save ai-next-btn" onclick="closeAIPlanWizard(); setTimeout(viewAIPlan, 200)">查看我的计划</button>
      <button class="ai-next-btn-ghost" onclick="closeAIPlanWizard()">稍后查看</button>
    </div>`;
}

// ===================== INTEGRATION HELPERS =====================

// Returns today's exercise from the AI plan, or null if rest day / no plan
function aiPlanGetTodayExercise() {
  const plan = aiPlanLoad();
  if (!plan || !plan.weeklyExercise) return null;
  const dayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const key = dayMap[new Date().getDay()];
  const ex = plan.weeklyExercise[key];
  return (ex && ex.name !== '休息日' && ex.duration > 0) ? ex : null;
}

// Returns AI daily diet suggestions, or null if no plan
function aiPlanGetDietSuggestion() {
  const plan = aiPlanLoad();
  if (!plan || !plan.dailyDiet) return null;
  const d = plan.dailyDiet;
  const hasMeals = d.breakfast || d.lunch || d.dinner || d.snack;
  return hasMeals ? d : null;
}

function _aiRenderPlanView(plan) {
  const ov = document.getElementById('aiPlanOverlay');
  if (!ov) return;

  const dietRows = [
    plan.dailyDiet?.breakfast ? `早餐：${plan.dailyDiet.breakfast}` : '',
    plan.dailyDiet?.lunch     ? `午餐：${plan.dailyDiet.lunch}`     : '',
    plan.dailyDiet?.dinner    ? `晚餐：${plan.dailyDiet.dinner}`    : '',
    plan.dailyDiet?.snack     ? `加餐：${plan.dailyDiet.snack}`     : '',
    plan.dailyDiet?.totalCalories ? `目标热量：${plan.dailyDiet.totalCalories} kcal/天` : '',
  ].filter(Boolean);

  const exerciseRows = Object.entries(plan.weeklyExercise || {}).map(([day, ex]) =>
    `<div class="ai-preview-row">
      <span>${day}</span>
      <span>${ex.name === '休息日' ? '休息日' : `${ex.name}  ${ex.duration}min`}</span>
    </div>`
  ).join('');

  const createdDate = plan.createdAt
    ? new Date(plan.createdAt).toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' })
    : '';

  ov.innerHTML = `
    <div class="ai-wizard-sheet">
      <div class="ai-wizard-header">
        <button class="ai-wizard-nav-btn" onclick="closeAIPlanWizard()">✕ 关闭</button>
        <span class="ai-wizard-title">✨ 我的健康计划</span>
        <button class="ai-wizard-nav-btn ai-regen-btn" onclick="openAIPlanWizard()">重新生成</button>
      </div>
      <div class="ai-wizard-body">
        <div class="ai-plan-date">生成于 ${createdDate}</div>

        ${plan.overview ? `
        <div class="ai-preview-section">
          <div class="ai-preview-section-title">📋 计划概述</div>
          <div class="ai-preview-text">${plan.overview}</div>
        </div>` : ''}

        ${dietRows.length ? `
        <div class="ai-preview-section">
          <div class="ai-preview-section-title">🍽️ 每日饮食建议</div>
          ${dietRows.map(t => `<div class="ai-preview-row-text">${t}</div>`).join('')}
        </div>` : ''}

        ${exerciseRows ? `
        <div class="ai-preview-section">
          <div class="ai-preview-section-title">🏃 每周运动安排</div>
          ${exerciseRows}
        </div>` : ''}

        ${plan.weeklyTasks?.length ? `
        <div class="ai-preview-section">
          <div class="ai-preview-section-title">✅ 每周习惯目标</div>
          ${plan.weeklyTasks.map(t => `<div class="ai-preview-row-text">• ${t}</div>`).join('')}
        </div>` : ''}

        ${plan.notes?.length ? `
        <div class="ai-preview-section">
          <div class="ai-preview-section-title">⚠️ 注意事项</div>
          ${plan.notes.map(t => `<div class="ai-preview-row-text">• ${t}</div>`).join('')}
        </div>` : ''}

        <button class="ai-next-btn-ghost" style="width:100%;margin-top:8px" onclick="openAIPlanWizard()">
          重新生成计划
        </button>
      </div>
    </div>`;
}
