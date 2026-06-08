'use strict';
// ===================== HEALTH MODULE =====================

// ---- Inline Data Manager ----
const healthData = {
  weight: [],
  diet: {},
  exercise: {},
  goals: { weight: null, dailyCalories: 2000, dailyWater: 2000, dailyExercise: 30, macroRatio: { protein: 30, carbs: 50, fat: 20 } },
  profile: { height: null, age: null, gender: 'other', activityLevel: 'moderate' }
};

function healthGetToday() {
  return new Date().toLocaleDateString('zh-CN');
}

function healthLoad() {
  const keys = ['weight', 'diet', 'exercise', 'goals', 'profile'];
  keys.forEach(k => {
    try {
      const raw = localStorage.getItem(`health_${k}`);
      if (raw) healthData[k] = JSON.parse(raw);
    } catch(e) {}
  });
}

function healthSave(module, data) {
  healthData[module] = data;
  try { localStorage.setItem(`health_${module}`, JSON.stringify(data)); } catch(e) {}
  window.app?.onDataChanged?.('health');
}

function healthGetTodayData(module) {
  const today = healthGetToday();
  if (module === 'weight') return healthData.weight.find(r => r.date === today) || null;
  return healthData[module][today] || null;
}

function healthGetLatestWeight() {
  return healthData.weight.length > 0 ? healthData.weight[0] : null;
}

function healthGenerateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ---- Health Toast (reuses planner's showToast if available) ----
function healthShowToast(msg) {
  if (typeof showToast === 'function') { showToast(msg); return; }
  let t = document.getElementById('appToast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.id = 'appToast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ===================== DASHBOARD =====================
function renderHealthDashboard(root) {
  const latestWeight = healthGetLatestWeight();
  const todayDiet = healthGetTodayData('diet');
  const todayExercise = healthGetTodayData('exercise');
  const goals = healthData.goals;
  const dietCal = todayDiet ? todayDiet.totalCalories : 0;
  const exerciseDuration = todayExercise ? todayExercise.totalDuration : 0;
  const waterIntake = todayDiet ? (todayDiet.waterIntake || 0) : 0;
  const bmi = healthData.profile.height && latestWeight ? calculateBMI(latestWeight.weight, healthData.profile.height) : null;
  const bmiStatus = bmi ? getBMIStatus(bmi) : '';

  const weightChange = healthData.weight.length >= 2 ? (() => {
    const diff = (healthData.weight[0].weight - healthData.weight[1].weight).toFixed(1);
    return `<div class="weight-change ${diff < 0 ? 'weight-change-down' : 'weight-change-up'}">${diff > 0 ? '+' : ''}${diff} kg ${diff < 0 ? '↓' : '↑'}</div>`;
  })() : '';

  root.innerHTML = `
    <div class="health-dashboard">
      <div class="dashboard-weight-card">
        <div class="weight-label">当前体重</div>
        <div class="weight-value">${latestWeight ? latestWeight.weight.toFixed(1) : '--'}</div>
        <div class="weight-unit">kg${bmi ? ` · BMI ${bmi} ${bmiStatus}` : ''}</div>
        ${weightChange}
      </div>
      <div class="dashboard-stats">
        <div class="stat-item">
          <div class="stat-icon">🍽️</div>
          <div class="stat-label">卡路里</div>
          <div class="stat-value">${dietCal} / ${goals.dailyCalories}</div>
          <div class="stat-bar"><div class="stat-fill" style="width:${Math.min(dietCal/goals.dailyCalories*100,100)}%;background:#f59e0b"></div></div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">💪</div>
          <div class="stat-label">运动</div>
          <div class="stat-value">${exerciseDuration} / ${goals.dailyExercise} 分钟</div>
          <div class="stat-bar"><div class="stat-fill" style="width:${Math.min(exerciseDuration/goals.dailyExercise*100,100)}%;background:#10b981"></div></div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">💧</div>
          <div class="stat-label">饮水</div>
          <div class="stat-value">${waterIntake} / ${goals.dailyWater} ml</div>
          <div class="stat-bar"><div class="stat-fill" style="width:${Math.min(waterIntake/goals.dailyWater*100,100)}%;background:#3b82f6"></div></div>
        </div>
      </div>
      <div class="dashboard-actions">
        <h3 class="section-title">快速操作</h3>
        <div class="action-buttons">
          <button class="action-btn" data-action="weight"><span class="action-icon">⚖️</span><span class="action-text">记体重</span></button>
          <button class="action-btn" data-action="diet"><span class="action-icon">🍴</span><span class="action-text">记饮食</span></button>
          <button class="action-btn" data-action="exercise"><span class="action-icon">🏃</span><span class="action-text">记运动</span></button>
        </div>
      </div>
    </div>`;

  root.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => window.app?.navigateTo?.(btn.dataset.action));
  });
}

// ===================== DIET =====================
let dietCurrentExpanded = null;
let dietWeightChart = null;

function renderHealthDiet(root) {
  const todayData = healthGetTodayData('diet') || dietDefaultData();
  const goals = healthData.goals;
  const totals = dietCalcTotals(todayData);
  const circumference = 2 * Math.PI * 60;
  const pct = Math.min(totals.calories / goals.dailyCalories, 1);
  const dashArr = `${circumference} ${circumference * (1 - pct)}`;

  // AI diet suggestion card (shown if user has an AI plan)
  let aiDietCard = '';
  if (typeof aiPlanGetDietSuggestion === 'function') {
    const d = aiPlanGetDietSuggestion();
    if (d) {
      const meals = [
        d.breakfast ? `早餐：${d.breakfast}` : '',
        d.lunch     ? `午餐：${d.lunch}`     : '',
        d.dinner    ? `晚餐：${d.dinner}`    : '',
        d.snack     ? `加餐：${d.snack}`     : '',
      ].filter(Boolean);
      aiDietCard = `<div class="ai-diet-hint-card">
        <div class="ai-diet-hint-header">
          <span>✨ AI饮食建议</span>
          <span class="ai-diet-hint-cal">目标 ${d.totalCalories || '--'} kcal/天</span>
        </div>
        <div class="ai-diet-hint-body">${meals.map(m => `<div>${m}</div>`).join('')}</div>
      </div>`;
    }
  }

  root.innerHTML = `
    <div class="diet-module">
      ${aiDietCard}
      <div class="diet-summary-card">
        <div class="summary-header">
          <div class="summary-label">今日摄入</div>
          <div class="summary-value">${totals.calories} / ${goals.dailyCalories} kcal</div>
        </div>
        <div class="progress-ring-container">
          <svg class="progress-ring" width="140" height="140">
            <circle class="progress-ring-bg" cx="70" cy="70" r="60"></circle>
            <circle class="progress-ring-fill" cx="70" cy="70" r="60" style="stroke-dasharray:${dashArr}"></circle>
          </svg>
          <div class="progress-center">${Math.round(pct*100)}%</div>
        </div>
        <div class="macro-stats">
          <div class="macro-item"><div class="macro-label">蛋白质</div><div class="macro-value">${totals.protein}g</div><div class="macro-bar"><div class="macro-fill macro-protein" style="width:${dietMacroBarPct('protein',totals)}%"></div></div></div>
          <div class="macro-item"><div class="macro-label">碳水</div><div class="macro-value">${totals.carbs}g</div><div class="macro-bar"><div class="macro-fill macro-carbs" style="width:${dietMacroBarPct('carbs',totals)}%"></div></div></div>
          <div class="macro-item"><div class="macro-label">脂肪</div><div class="macro-value">${totals.fat}g</div><div class="macro-bar"><div class="macro-fill macro-fat" style="width:${dietMacroBarPct('fat',totals)}%"></div></div></div>
        </div>
      </div>
      <div class="meals-grid">
        ${dietMealCard('breakfast','早餐','🌅',todayData.meals.breakfast)}
        ${dietMealCard('lunch','午餐','🌞',todayData.meals.lunch)}
        ${dietMealCard('dinner','晚餐','🌙',todayData.meals.dinner)}
        ${dietMealCard('snacks','加餐','🍎',todayData.meals.snacks)}
      </div>
      <div class="water-card">
        <div class="water-header"><span class="water-icon">💧</span><span class="water-label">饮水记录</span></div>
        <div class="water-progress">
          <div class="water-value">${todayData.waterIntake||0} / ${goals.dailyWater} ml</div>
          <div class="water-bar"><div class="water-fill" style="width:${Math.min((todayData.waterIntake||0)/goals.dailyWater*100,100)}%"></div></div>
        </div>
        <div class="water-buttons">
          <button class="btn-water" data-amount="250">+250ml</button>
          <button class="btn-water" data-amount="500">+500ml</button>
          <button class="btn-water" data-amount="1000">+1000ml</button>
        </div>
      </div>
    </div>`;

  root.querySelectorAll('.meal-card').forEach(card => {
    card.querySelector('.meal-header').addEventListener('click', () => {
      const mt = card.dataset.meal;
      dietCurrentExpanded = dietCurrentExpanded === mt ? null : mt;
      renderHealthTab('diet', root.closest('#appMain'));
    });
  });
  root.querySelectorAll('.btn-add-food').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); dietShowFoodDialog(btn.dataset.meal); });
  });
  root.querySelectorAll('.btn-delete-food').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); dietDeleteFood(btn.dataset.meal, parseInt(btn.dataset.index)); });
  });
  root.querySelectorAll('.btn-water').forEach(btn => {
    btn.addEventListener('click', () => dietAddWater(parseInt(btn.dataset.amount)));
  });
}

function dietMealCard(mealType, mealName, icon, foods) {
  const totalCal = foods.reduce((s, f) => s + f.calories, 0);
  const isExpanded = dietCurrentExpanded === mealType;
  return `<div class="meal-card ${isExpanded ? 'expanded' : ''}" data-meal="${mealType}">
    <div class="meal-header">
      <div class="meal-info"><span class="meal-icon">${icon}</span><span class="meal-name">${mealName}</span></div>
      <div class="meal-calories">${totalCal} kcal <span class="expand-icon">›</span></div>
    </div>
    <div class="meal-content">
      ${foods.length > 0 ? foods.map((f, i) => `<div class="food-item"><div class="food-info"><div class="food-name">${f.name}</div><div class="food-nutrients">蛋白${f.protein}g | 碳水${f.carbs}g | 脂肪${f.fat}g</div></div><div class="food-actions"><span class="food-cal">${f.calories} kcal</span><button class="btn-delete-food" data-meal="${mealType}" data-index="${i}">×</button></div></div>`).join('') : '<div class="empty-meal">暂无食物记录</div>'}
      <button class="btn-add-food" data-meal="${mealType}">+ 添加食物</button>
    </div>
  </div>`;
}

function dietCalcTotals(data) {
  let calories=0, protein=0, carbs=0, fat=0;
  Object.values(data.meals).forEach(foods => foods.forEach(f => { calories+=f.calories; protein+=f.protein; carbs+=f.carbs; fat+=f.fat; }));
  return { calories: Math.round(calories), protein: Math.round(protein*10)/10, carbs: Math.round(carbs*10)/10, fat: Math.round(fat*10)/10 };
}

function dietMacroBarPct(key, totals) {
  const total = totals.protein + totals.carbs + totals.fat;
  return total > 0 ? Math.round(totals[key] / total * 100) : 0;
}

function dietDefaultData() {
  return { date: healthGetToday(), meals: { breakfast:[], lunch:[], dinner:[], snacks:[] }, totalCalories:0, waterIntake:0, timestamp: Date.now() };
}

// ---- In-app confirm sheet (replaces native confirm()) ----
function healthConfirm(msg, onConfirm, confirmLabel) {
  const sheet = document.createElement('div');
  sheet.className = 'health-confirm-overlay';
  sheet.innerHTML = `
    <div class="health-confirm-sheet">
      <div class="health-confirm-msg">${msg}</div>
      <div class="health-confirm-actions">
        <button class="health-confirm-cancel">取消</button>
        <button class="health-confirm-ok">${confirmLabel || '删除'}</button>
      </div>
    </div>`;
  document.body.appendChild(sheet);
  const remove = () => { if (document.body.contains(sheet)) document.body.removeChild(sheet); };
  sheet.querySelector('.health-confirm-cancel').addEventListener('click', remove);
  sheet.querySelector('.health-confirm-ok').addEventListener('click', () => { remove(); onConfirm(); });
}

function dietShowFoodDialog(mealType) {
  // Close any existing food dialog
  document.querySelectorAll('.food-dialog').forEach(d => { if (document.body.contains(d)) document.body.removeChild(d); });

  const mealNames = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snacks: '加餐' };
  const CATEGORIES = ['全部', '主食', '肉类', '蛋奶', '蔬菜', '水果', '豆类', '坚果'];

  const dialog = document.createElement('div');
  dialog.className = 'food-dialog';
  document.body.appendChild(dialog);

  let currentCategory = '全部';
  let currentSearch = '';

  function close() {
    if (document.body.contains(dialog)) document.body.removeChild(dialog);
  }

  function getContextHTML() {
    const today = healthGetToday();
    const todayData = healthGetTodayData('diet') || dietDefaultData();
    const mealCals = (todayData.meals[mealType] || []).reduce((s, f) => s + f.calories, 0);
    const totalCals = dietCalcTotals(todayData).calories;
    const goalCals = healthData.goals.dailyCalories || 2000;
    return `<div class="dialog-context">
      <span>本餐已记 <b>${mealCals}</b> kcal</span>
      <span>今日 ${totalCals} / ${goalCals} kcal</span>
    </div>`;
  }

  function getFoodList() {
    if (currentSearch) return searchFoods(currentSearch);
    if (currentCategory === '全部') return FOOD_DATABASE;
    return getFoodsByCategory(currentCategory);
  }

  function renderBrowse() {
    const foods = getFoodList();
    dialog.innerHTML = `
      <div class="dialog-overlay"></div>
      <div class="dialog-content">
        <div class="dialog-header">
          <h3>添加食物 · ${mealNames[mealType] || mealType}</h3>
          <button class="dialog-close">✕</button>
        </div>
        ${getContextHTML()}
        <div class="dialog-body">
          <input type="text" class="food-search" placeholder="搜索食物..." value="${currentSearch}">
          <div class="food-categories">
            ${CATEGORIES.map(c =>
              `<button class="category-btn${currentCategory === c ? ' active' : ''}" data-cat="${c}">${c}</button>`
            ).join('')}
          </div>
          <div class="food-list">
            ${foods.length
              ? foods.map(f =>
                  `<div class="db-food-item" data-id="${f.id}">
                    <div class="db-food-info">
                      <div class="db-food-name">${f.name}</div>
                      <div class="db-food-nutrients">${f.calories} kcal | 蛋白${f.protein}g 碳水${f.carbs}g 脂肪${f.fat}g</div>
                    </div>
                    <div class="db-food-add">+</div>
                  </div>`
                ).join('')
              : '<div class="empty-state" style="text-align:center;padding:32px 0">未找到相关食物</div>'
            }
          </div>
          <button class="btn-custom-food">✏️ 手动输入自定义食物</button>
        </div>
      </div>`;

    dialog.querySelector('.dialog-overlay').addEventListener('click', close);
    dialog.querySelector('.dialog-close').addEventListener('click', close);

    // Refresh only the food list — does NOT rebuild the dialog, preserves input focus & IME state
    function refreshFoodList() {
      const list = dialog.querySelector('.food-list');
      if (!list) return;
      const foods = getFoodList();
      list.innerHTML = foods.length
        ? foods.map(f =>
            `<div class="db-food-item" data-id="${f.id}">
              <div class="db-food-info">
                <div class="db-food-name">${f.name}</div>
                <div class="db-food-nutrients">${f.calories} kcal | 蛋白${f.protein}g 碳水${f.carbs}g 脂肪${f.fat}g</div>
              </div>
              <div class="db-food-add">+</div>
            </div>`
          ).join('')
        : '<div class="empty-state" style="text-align:center;padding:32px 0">未找到相关食物</div>';
    }

    const searchInput = dialog.querySelector('.food-search');
    let isComposing = false;

    // compositionstart/end: handle Chinese/Japanese/Korean IME input
    // During composition (pinyin being typed), don't search yet
    searchInput.addEventListener('compositionstart', () => { isComposing = true; });
    searchInput.addEventListener('compositionend', e => {
      isComposing = false;
      currentSearch = e.target.value;
      if (currentSearch) currentCategory = '全部';
      refreshFoodList();
    });
    searchInput.addEventListener('input', e => {
      if (isComposing) return; // Wait for IME to commit
      currentSearch = e.target.value;
      if (currentSearch) currentCategory = '全部';
      refreshFoodList();
    });

    dialog.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentCategory = btn.dataset.cat;
        currentSearch = '';
        searchInput.value = '';
        // Update active state on buttons without full re-render
        dialog.querySelectorAll('.category-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.cat === currentCategory)
        );
        refreshFoodList();
      });
    });

    dialog.querySelector('.food-list').addEventListener('click', e => {
      const item = e.target.closest('.db-food-item');
      if (!item) return;
      const food = FOOD_DATABASE.find(f => f.id === parseInt(item.dataset.id));
      if (food) renderQuantityEdit(food);
    });

    dialog.querySelector('.btn-custom-food').addEventListener('click', renderCustomInput);
  }

  function calcNutrition(food, grams) {
    const r = grams / 100;
    return {
      calories: Math.round(food.calories * r),
      protein:  Math.round(food.protein  * r * 10) / 10,
      carbs:    Math.round(food.carbs    * r * 10) / 10,
      fat:      Math.round(food.fat      * r * 10) / 10,
    };
  }

  function nutritionHTML(n) {
    return `<span class="qty-cal">${n.calories} <small>kcal</small></span>
            <span class="qty-macro">蛋白 ${n.protein}g</span>
            <span class="qty-macro">碳水 ${n.carbs}g</span>
            <span class="qty-macro">脂肪 ${n.fat}g</span>`;
  }

  function renderQuantityEdit(food) {
    const body = dialog.querySelector('.dialog-body');
    body.innerHTML = `
      <div class="quantity-editor">
        <button class="qty-back-btn">‹ 返回列表</button>
        <div class="qty-food-name">${food.name}</div>
        <div class="qty-input-row">
          <label class="qty-label">克数</label>
          <input type="number" class="text-input qty-input" id="qtyGrams" value="100" min="1" max="9999">
          <span class="qty-unit">g</span>
        </div>
        <div class="qty-result" id="qtyResult">${nutritionHTML(calcNutrition(food, 100))}</div>
        <button class="btn-save" id="btnConfirmQty">确认添加</button>
      </div>`;

    const gramsInput = body.querySelector('#qtyGrams');
    gramsInput.focus(); gramsInput.select();
    gramsInput.addEventListener('input', () => {
      const g = parseFloat(gramsInput.value) || 0;
      body.querySelector('#qtyResult').innerHTML = nutritionHTML(calcNutrition(food, g));
    });

    body.querySelector('.qty-back-btn').addEventListener('click', renderBrowse);
    body.querySelector('#btnConfirmQty').addEventListener('click', () => {
      const g = parseFloat(gramsInput.value);
      if (!g || g <= 0) { healthShowToast('请输入有效克数'); return; }
      const n = calcNutrition(food, g);
      dietAddFoodEntry(mealType, { id: healthGenerateId('food'), name: `${food.name}（${g}g）`, ...n });
      close();
    });
  }

  function renderCustomInput() {
    const body = dialog.querySelector('.dialog-body');
    body.innerHTML = `
      <div class="custom-food-form">
        <button class="qty-back-btn">‹ 返回列表</button>
        <div class="custom-form-title">手动输入食物</div>
        <div class="custom-form-desc">填写热量后即可添加，蛋白/碳水/脂肪选填</div>
        <div class="custom-form-row"><label>食物名称 *</label><input type="text"   class="text-input" id="cfName"  placeholder="如：自制沙拉"></div>
        <div class="custom-form-row"><label>克数 *</label>    <input type="number" class="text-input" id="cfGrams" value="100" min="1" placeholder="g"></div>
        <div class="custom-form-row"><label>热量 *</label>    <input type="number" class="text-input" id="cfCal"   placeholder="kcal" min="0"></div>
        <div class="custom-form-row"><label>蛋白质</label>    <input type="number" class="text-input" id="cfPro"   placeholder="g（选填）" min="0" step="0.1"></div>
        <div class="custom-form-row"><label>碳水</label>      <input type="number" class="text-input" id="cfCarb"  placeholder="g（选填）" min="0" step="0.1"></div>
        <div class="custom-form-row"><label>脂肪</label>      <input type="number" class="text-input" id="cfFat"   placeholder="g（选填）" min="0" step="0.1"></div>
        <button class="btn-save" id="btnConfirmCustom" style="margin-top:4px">确认添加</button>
      </div>`;

    body.querySelector('.qty-back-btn').addEventListener('click', renderBrowse);
    body.querySelector('#btnConfirmCustom').addEventListener('click', () => {
      const name  = body.querySelector('#cfName').value.trim();
      const grams = parseFloat(body.querySelector('#cfGrams').value) || 100;
      const cal   = parseFloat(body.querySelector('#cfCal').value);
      if (!name)          { healthShowToast('请输入食物名称'); return; }
      if (isNaN(cal))     { healthShowToast('请输入热量'); return; }
      dietAddFoodEntry(mealType, {
        id:       healthGenerateId('food'),
        name:     `${name}（${grams}g）`,
        calories: Math.round(cal),
        protein:  parseFloat(body.querySelector('#cfPro').value)  || 0,
        carbs:    parseFloat(body.querySelector('#cfCarb').value) || 0,
        fat:      parseFloat(body.querySelector('#cfFat').value)  || 0,
      });
      close();
    });
  }

  renderBrowse();
}

function dietAddFoodEntry(mealType, entry) {
  const today = healthGetToday();
  const dietAll = { ...healthData.diet };
  const todayData = dietAll[today] || dietDefaultData();
  todayData.meals[mealType].push(entry);
  todayData.totalCalories = dietCalcTotals(todayData).calories;
  dietAll[today] = todayData;
  healthSave('diet', dietAll);
  healthShowToast('添加成功 ✓');
  renderHealthTab('diet', document.getElementById('appMain'));
}

function dietDeleteFood(mealType, index) {
  healthConfirm('确定删除这条饮食记录吗？', () => {
    const today = healthGetToday();
    const dietAll = { ...healthData.diet };
    const todayData = dietAll[today] || dietDefaultData();
    todayData.meals[mealType].splice(index, 1);
    todayData.totalCalories = dietCalcTotals(todayData).calories;
    dietAll[today] = todayData;
    healthSave('diet', dietAll);
    healthShowToast('已删除');
    renderHealthTab('diet', document.getElementById('appMain'));
  });
}

function dietAddWater(amount) {
  const today = healthGetToday();
  const dietAll = { ...healthData.diet };
  const todayData = dietAll[today] || dietDefaultData();
  todayData.waterIntake = (todayData.waterIntake || 0) + amount;
  dietAll[today] = todayData;
  healthSave('diet', dietAll);
  healthShowToast(`+${amount}ml 💧`);
  renderHealthTab('diet', document.getElementById('appMain'));
}

// ===================== WEIGHT =====================
let weightChartInstance = null;

function renderHealthWeight(root) {
  if (weightChartInstance) { weightChartInstance.destroy(); weightChartInstance = null; }
  const latest = healthGetLatestWeight();
  const records30 = healthData.weight.slice(0, 30).reverse();
  const goals = healthData.goals;

  root.innerHTML = `
    <div class="weight-module">
      <div class="current-weight-card">
        <div class="stat-label">当前体重</div>
        <div class="stat-value">${latest ? latest.weight.toFixed(1) : '--'}</div>
        <div class="stat-unit">kg${goals.weight ? ' · 目标: ' + goals.weight + 'kg' : ''}</div>
      </div>
      <div class="chart-card"><h3 class="section-title">体重趋势</h3><div style="height:200px;position:relative"><canvas id="weightChart"></canvas></div></div>
      <div class="quick-checkin">
        <h3 class="section-title">今日打卡</h3>
        <div class="weight-input-row">
          <input type="number" id="weightInput" step="0.1" min="20" max="300" placeholder="输入体重 (kg)" style="flex:1">
          <button class="btn-primary" id="btnWeightSubmit">打卡</button>
        </div>
      </div>
      <div class="weight-history">
        <h3 class="section-title">历史记录</h3>
        ${healthData.weight.slice(0, 10).map((r, i) => `
          <div class="weight-record-item">
            <span class="weight-record-date">${r.date}</span>
            <span class="weight-record-val">${r.weight.toFixed(1)} kg</span>
            <button class="btn-delete-weight" data-index="${i}">×</button>
          </div>`).join('') || '<div class="empty-state">暂无记录</div>'}
      </div>
    </div>`;

  requestAnimationFrame(() => {
    const ctx = root.querySelector('#weightChart');
    if (ctx && records30.length > 0) {
      const labels = records30.map(r => { const d = new Date(r.timestamp); return `${d.getMonth()+1}/${d.getDate()}`; });
      weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label:'体重(kg)', data: records30.map(r => r.weight), borderColor:'#667eea', backgroundColor:'rgba(102,126,234,0.1)', borderWidth:3, tension:0.4, fill:true, pointRadius:4 }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:false, ticks:{font:{size:11}}}, x:{ticks:{font:{size:10}}} } }
      });
    }
  });

  root.querySelector('#btnWeightSubmit').addEventListener('click', () => {
    const val = parseFloat(root.querySelector('#weightInput').value);
    if (!val || val < 20 || val > 300) { healthShowToast('请输入有效体重（20-300 kg）'); return; }
    weightAddRecord(val);
  });
  root.querySelectorAll('.btn-delete-weight').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      healthConfirm('确定删除这条体重记录吗？', () => {
        const records = [...healthData.weight];
        records.splice(idx, 1);
        healthSave('weight', records);
        renderHealthTab('weight', document.getElementById('appMain'));
      });
    });
  });
}

function weightAddRecord(weight) {
  const today = healthGetToday();
  let records = [...healthData.weight];
  const existingIdx = records.findIndex(r => r.date === today);
  const record = { date: today, weight, timestamp: Date.now() };
  if (existingIdx >= 0) records[existingIdx] = record;
  else records.unshift(record);
  healthSave('weight', records);
  healthShowToast('体重打卡成功！✓');
  renderHealthTab('weight', document.getElementById('appMain'));
}

// ===================== EXERCISE =====================
function renderHealthExercise(root) {
  const todayData = healthGetTodayData('exercise') || exerciseDefaultData();
  const goals = healthData.goals;
  const EXERCISE_TYPES = [
    { type:'跑步', icon:'🏃' }, { type:'瑜伽', icon:'🧘' }, { type:'健身', icon:'💪' },
    { type:'骑行', icon:'🚴' }, { type:'游泳', icon:'🏊' }, { type:'跳绳', icon:'🎽' },
    { type:'快走', icon:'🚶' }, { type:'打篮球', icon:'🏀' }, { type:'打羽毛球', icon:'🏸' }, { type:'爬山', icon:'⛰️' }
  ];

  root.innerHTML = `
    <div class="exercise-module">
      <div class="exercise-summary">
        <div class="summary-label">今日运动</div>
        <div class="summary-value">${todayData.totalDuration} / ${goals.dailyExercise} 分钟</div>
        <div class="summary-calories">消耗 ${todayData.totalCalories} kcal</div>
        <div class="stat-bar" style="margin-top:10px"><div class="stat-fill" style="width:${Math.min(todayData.totalDuration/goals.dailyExercise*100,100)}%;background:#10b981"></div></div>
      </div>
      <div class="exercise-types">
        <h3 class="section-title">快速记录</h3>
        <div class="type-grid">
          ${EXERCISE_TYPES.map(t => `<button class="type-btn" data-type="${t.type}">${t.icon} ${t.type}</button>`).join('')}
        </div>
      </div>
      <div class="exercise-list">
        <h3 class="section-title">今日记录</h3>
        ${todayData.exercises.length > 0 ? todayData.exercises.map((ex, i) => `
          <div class="exercise-item">
            <div class="exercise-info">
              <div class="exercise-type">${ex.type}</div>
              <div class="exercise-details">${ex.duration}分钟 · ${ex.calories} kcal</div>
            </div>
            <button class="btn-del-exercise" data-index="${i}">×</button>
          </div>`).join('') : '<div class="empty-state">还没有运动记录，选择上方类型开始打卡吧 💪</div>'}
      </div>
    </div>`;

  root.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => exerciseShowDialog(btn.dataset.type));
  });
  root.querySelectorAll('.btn-del-exercise').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      healthConfirm('确定删除这条运动记录吗？', () => exerciseDelete(idx));
    });
  });
}

function exerciseDefaultData() {
  return { date: healthGetToday(), exercises: [], totalDuration: 0, totalCalories: 0, timestamp: Date.now() };
}

function exerciseShowDialog(type) {
  const modal = document.createElement('div');
  modal.className = 'exercise-dialog';
  modal.innerHTML = `
    <div class="dialog-overlay"></div>
    <div class="dialog-content" style="max-width:320px">
      <div class="dialog-header"><h3>${type}</h3><button class="dialog-close">×</button></div>
      <div class="dialog-body" style="padding:16px">
        <div class="time-label" style="margin-bottom:8px">时长（分钟）</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          ${[15,20,30,45,60,90].map(m => `<button class="btn-quick-lg" data-min="${m}">${m}min</button>`).join('')}
        </div>
        <input type="number" class="text-input" id="exDurationInput" placeholder="或输入自定义分钟数" min="1" max="600">
        <button class="btn-save" id="btnConfirmExercise" style="margin-top:12px">确认记录</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  let duration = null;
  modal.querySelectorAll('.btn-quick-lg').forEach(btn => {
    btn.addEventListener('click', () => {
      duration = parseInt(btn.dataset.min);
      modal.querySelectorAll('.btn-quick-lg').forEach(b => b.classList.toggle('selected', b === btn));
      modal.querySelector('#exDurationInput').value = duration;
    });
  });
  modal.querySelector('.dialog-close').addEventListener('click', () => document.body.removeChild(modal));
  modal.querySelector('.dialog-overlay').addEventListener('click', () => document.body.removeChild(modal));
  modal.querySelector('#btnConfirmExercise').addEventListener('click', () => {
    const val = parseInt(modal.querySelector('#exDurationInput').value) || duration;
    if (!val || val <= 0) { healthShowToast('请输入运动时长'); return; }
    document.body.removeChild(modal);
    exerciseAdd(type, val);
  });
}

function exerciseAdd(type, duration) {
  const weight = healthGetLatestWeight()?.weight || 65;
  const calories = calculateExerciseCalories(type, duration, weight);
  const today = healthGetToday();
  const exAll = { ...healthData.exercise };
  const todayData = exAll[today] || exerciseDefaultData();
  todayData.exercises.push({ id: healthGenerateId('ex'), type, duration, calories, time: new Date().toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'}) });
  todayData.totalDuration = todayData.exercises.reduce((s, e) => s + e.duration, 0);
  todayData.totalCalories = todayData.exercises.reduce((s, e) => s + e.calories, 0);
  exAll[today] = todayData;
  healthSave('exercise', exAll);
  healthShowToast(`已记录 ${type} ${duration}分钟 · 消耗 ${calories} kcal`);
  renderHealthTab('exercise', document.getElementById('appMain'));
}

function exerciseDelete(index) {
  const today = healthGetToday();
  const exAll = { ...healthData.exercise };
  const todayData = exAll[today] || exerciseDefaultData();
  todayData.exercises.splice(index, 1);
  todayData.totalDuration = todayData.exercises.reduce((s, e) => s + e.duration, 0);
  todayData.totalCalories = todayData.exercises.reduce((s, e) => s + e.calories, 0);
  exAll[today] = todayData;
  healthSave('exercise', exAll);
  healthShowToast('已删除');
  renderHealthTab('exercise', document.getElementById('appMain'));
}

// ===================== MAIN ROUTING =====================
function renderHealthTab(subTab, container) {
  if (!container) container = document.getElementById('appMain');
  // Destroy weight chart if leaving weight tab
  if (subTab !== 'weight' && weightChartInstance) { weightChartInstance.destroy(); weightChartInstance = null; }
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'tab-content';
  if (subTab === 'dashboard') renderHealthDashboard(root);
  else if (subTab === 'diet')  renderHealthDiet(root);
  else if (subTab === 'weight') renderHealthWeight(root);
  else if (subTab === 'exercise') renderHealthExercise(root);
  container.appendChild(root);
}
