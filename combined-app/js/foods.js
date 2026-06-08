'use strict';
// 食物数据库 — 直接来自健康模块
const FOOD_DATABASE = [
  { id: 1, name: '米饭（100g）', category: '主食', calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3 },
  { id: 2, name: '馒头（100g）', category: '主食', calories: 223, protein: 7.0, carbs: 47.0, fat: 1.1 },
  { id: 3, name: '面条（100g）', category: '主食', calories: 137, protein: 4.5, carbs: 28.6, fat: 0.5 },
  { id: 4, name: '全麦面包（100g）', category: '主食', calories: 246, protein: 8.5, carbs: 43.3, fat: 3.5 },
  { id: 5, name: '燕麦（100g）', category: '主食', calories: 367, protein: 15.0, carbs: 61.0, fat: 7.0 },
  { id: 6, name: '玉米（100g）', category: '主食', calories: 112, protein: 4.0, carbs: 22.8, fat: 1.2 },
  { id: 7, name: '红薯（100g）', category: '主食', calories: 99, protein: 1.1, carbs: 24.7, fat: 0.2 },
  { id: 8, name: '土豆（100g）', category: '主食', calories: 81, protein: 2.0, carbs: 17.8, fat: 0.2 },
  { id: 9, name: '紫薯（100g）', category: '主食', calories: 82, protein: 1.1, carbs: 20.1, fat: 0.2 },
  { id: 10, name: '意大利面（100g）', category: '主食', calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9 },
  { id: 11, name: '鸡胸肉（100g）', category: '肉类', calories: 133, protein: 19.4, carbs: 2.5, fat: 5.0 },
  { id: 12, name: '鸡腿肉（100g）', category: '肉类', calories: 181, protein: 20.0, carbs: 0.0, fat: 11.0 },
  { id: 13, name: '牛肉（瘦，100g）', category: '肉类', calories: 125, protein: 20.1, carbs: 0.0, fat: 4.2 },
  { id: 14, name: '猪肉（瘦，100g）', category: '肉类', calories: 143, protein: 20.3, carbs: 1.5, fat: 6.2 },
  { id: 15, name: '羊肉（瘦，100g）', category: '肉类', calories: 203, protein: 17.3, carbs: 0.0, fat: 14.1 },
  { id: 16, name: '鱼肉（100g）', category: '肉类', calories: 109, protein: 19.2, carbs: 0.0, fat: 3.4 },
  { id: 17, name: '虾（100g）', category: '肉类', calories: 93, protein: 18.6, carbs: 2.8, fat: 0.8 },
  { id: 18, name: '三文鱼（100g）', category: '肉类', calories: 139, protein: 19.8, carbs: 0.0, fat: 6.3 },
  { id: 19, name: '鸡蛋（1个约50g）', category: '蛋奶', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { id: 20, name: '牛奶（250ml）', category: '蛋奶', calories: 163, protein: 8.3, carbs: 12.0, fat: 9.5 },
  { id: 21, name: '脱脂牛奶（250ml）', category: '蛋奶', calories: 88, protein: 8.8, carbs: 12.5, fat: 0.5 },
  { id: 22, name: '酸奶（100g）', category: '蛋奶', calories: 72, protein: 2.5, carbs: 9.3, fat: 2.7 },
  { id: 23, name: '希腊酸奶（100g）', category: '蛋奶', calories: 97, protein: 9.0, carbs: 3.6, fat: 5.0 },
  { id: 24, name: '奶酪（100g）', category: '蛋奶', calories: 328, protein: 25.0, carbs: 3.5, fat: 23.5 },
  { id: 25, name: '豆腐（100g）', category: '豆制品', calories: 81, protein: 8.1, carbs: 4.2, fat: 3.7 },
  { id: 26, name: '豆浆（250ml）', category: '豆制品', calories: 35, protein: 2.9, carbs: 1.8, fat: 1.6 },
  { id: 27, name: '豆腐干（100g）', category: '豆制品', calories: 140, protein: 15.8, carbs: 7.5, fat: 5.2 },
  { id: 28, name: '毛豆（100g）', category: '豆制品', calories: 125, protein: 13.0, carbs: 8.5, fat: 5.0 },
  { id: 29, name: '西兰花（100g）', category: '蔬菜', calories: 36, protein: 4.1, carbs: 4.3, fat: 0.6 },
  { id: 30, name: '菠菜（100g）', category: '蔬菜', calories: 28, protein: 2.6, carbs: 4.5, fat: 0.3 },
  { id: 31, name: '生菜（100g）', category: '蔬菜', calories: 15, protein: 1.3, carbs: 2.1, fat: 0.2 },
  { id: 32, name: '番茄（100g）', category: '蔬菜', calories: 19, protein: 0.9, carbs: 3.8, fat: 0.2 },
  { id: 33, name: '黄瓜（100g）', category: '蔬菜', calories: 16, protein: 0.8, carbs: 2.9, fat: 0.2 },
  { id: 34, name: '胡萝卜（100g）', category: '蔬菜', calories: 39, protein: 1.0, carbs: 8.8, fat: 0.2 },
  { id: 35, name: '青椒（100g）', category: '蔬菜', calories: 22, protein: 1.0, carbs: 4.9, fat: 0.2 },
  { id: 36, name: '芹菜（100g）', category: '蔬菜', calories: 16, protein: 0.8, carbs: 3.0, fat: 0.1 },
  { id: 37, name: '白菜（100g）', category: '蔬菜', calories: 17, protein: 1.5, carbs: 2.4, fat: 0.2 },
  { id: 38, name: '卷心菜（100g）', category: '蔬菜', calories: 24, protein: 1.3, carbs: 4.6, fat: 0.2 },
  { id: 39, name: '苹果（1个约200g）', category: '水果', calories: 104, protein: 0.5, carbs: 27.6, fat: 0.3 },
  { id: 40, name: '香蕉（1根约120g）', category: '水果', calories: 108, protein: 1.3, carbs: 27.6, fat: 0.4 },
  { id: 41, name: '橙子（1个约150g）', category: '水果', calories: 70, protein: 1.4, carbs: 17.6, fat: 0.2 },
  { id: 42, name: '葡萄（100g）', category: '水果', calories: 69, protein: 0.7, carbs: 17.1, fat: 0.4 },
  { id: 43, name: '草莓（100g）', category: '水果', calories: 32, protein: 1.0, carbs: 7.0, fat: 0.2 },
  { id: 44, name: '蓝莓（100g）', category: '水果', calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3 },
  { id: 45, name: '西瓜（100g）', category: '水果', calories: 30, protein: 0.6, carbs: 7.6, fat: 0.2 },
  { id: 46, name: '猕猴桃（1个约80g）', category: '水果', calories: 49, protein: 0.8, carbs: 11.7, fat: 0.4 },
  { id: 47, name: '梨（1个约200g）', category: '水果', calories: 114, protein: 0.7, carbs: 30.4, fat: 0.2 },
  { id: 48, name: '桃子（1个约150g）', category: '水果', calories: 59, protein: 1.4, carbs: 14.3, fat: 0.4 },
  { id: 49, name: '杏仁（30g）', category: '坚果', calories: 173, protein: 6.4, carbs: 6.5, fat: 15.0 },
  { id: 50, name: '核桃（30g）', category: '坚果', calories: 196, protein: 4.6, carbs: 4.1, fat: 19.7 },
  { id: 51, name: '腰果（30g）', category: '坚果', calories: 165, protein: 5.2, carbs: 9.3, fat: 13.1 },
  { id: 52, name: '花生（30g）', category: '坚果', calories: 170, protein: 7.8, carbs: 4.8, fat: 14.4 },
  { id: 53, name: '黑巧克力（30g）', category: '零食', calories: 159, protein: 2.0, carbs: 15.0, fat: 10.5 },
  { id: 54, name: '薯片（30g）', category: '零食', calories: 162, protein: 1.9, carbs: 16.0, fat: 10.8 },
  { id: 55, name: '饼干（30g）', category: '零食', calories: 141, protein: 2.1, carbs: 20.1, fat: 6.0 },
  { id: 56, name: '可乐（330ml）', category: '饮品', calories: 140, protein: 0.0, carbs: 35.0, fat: 0.0 },
  { id: 57, name: '橙汁（250ml）', category: '饮品', calories: 113, protein: 1.8, carbs: 25.8, fat: 0.5 },
  { id: 58, name: '咖啡（无糖，250ml）', category: '饮品', calories: 5, protein: 0.3, carbs: 0.0, fat: 0.0 },
  { id: 59, name: '拿铁（250ml）', category: '饮品', calories: 103, protein: 5.3, carbs: 9.5, fat: 4.8 },
  { id: 60, name: '奶茶（500ml）', category: '饮品', calories: 350, protein: 8.0, carbs: 50.0, fat: 12.0 },
  { id: 61, name: '宫保鸡丁（一份）', category: '菜肴', calories: 280, protein: 20.0, carbs: 15.0, fat: 16.0 },
  { id: 62, name: '鱼香肉丝（一份）', category: '菜肴', calories: 320, protein: 18.0, carbs: 22.0, fat: 18.0 },
  { id: 63, name: '红烧肉（一份）', category: '菜肴', calories: 450, protein: 25.0, carbs: 10.0, fat: 35.0 },
  { id: 64, name: '麻婆豆腐（一份）', category: '菜肴', calories: 240, protein: 15.0, carbs: 12.0, fat: 15.0 },
  { id: 65, name: '西红柿炒蛋（一份）', category: '菜肴', calories: 180, protein: 10.0, carbs: 8.0, fat: 12.0 },
  { id: 66, name: '青椒炒肉（一份）', category: '菜肴', calories: 260, protein: 18.0, carbs: 10.0, fat: 17.0 },
  { id: 67, name: '炒青菜（一份）', category: '菜肴', calories: 80, protein: 3.0, carbs: 6.0, fat: 5.0 },
  { id: 68, name: '汉堡（1个）', category: '快餐', calories: 540, protein: 25.0, carbs: 45.0, fat: 27.0 },
  { id: 69, name: '披萨（1片）', category: '快餐', calories: 285, protein: 12.0, carbs: 36.0, fat: 10.0 },
  { id: 70, name: '炸鸡（1块）', category: '快餐', calories: 320, protein: 16.0, carbs: 15.0, fat: 22.0 },
  { id: 71, name: '三明治（1个）', category: '快餐', calories: 280, protein: 14.0, carbs: 32.0, fat: 11.0 },
  { id: 72, name: '沙拉（1份）', category: '快餐', calories: 150, protein: 8.0, carbs: 12.0, fat: 8.0 },
  { id: 73, name: '油条（1根）', category: '早餐', calories: 270, protein: 6.0, carbs: 28.0, fat: 15.0 },
  { id: 74, name: '豆浆油条套餐', category: '早餐', calories: 305, protein: 8.9, carbs: 29.8, fat: 16.6 },
  { id: 75, name: '包子（1个）', category: '早餐', calories: 200, protein: 7.0, carbs: 28.0, fat: 6.0 },
  { id: 76, name: '煎饼果子（1个）', category: '早餐', calories: 420, protein: 14.0, carbs: 52.0, fat: 18.0 },
  { id: 77, name: '粥（1碗）', category: '早餐', calories: 60, protein: 1.5, carbs: 13.0, fat: 0.2 },
  { id: 78, name: '鸡胸肉沙拉（1份）', category: '健身餐', calories: 250, protein: 30.0, carbs: 15.0, fat: 8.0 },
  { id: 79, name: '燕麦牛奶（1碗）', category: '健身餐', calories: 250, protein: 10.0, carbs: 40.0, fat: 5.0 },
  { id: 80, name: '蛋白质奶昔（1杯）', category: '健身餐', calories: 180, protein: 25.0, carbs: 12.0, fat: 3.0 },
  { id: 81, name: '全麦三明治（1个）', category: '健身餐', calories: 320, protein: 18.0, carbs: 42.0, fat: 9.0 },
  { id: 82, name: '饺子（10个）', category: '主食', calories: 450, protein: 18.0, carbs: 55.0, fat: 16.0 },
  { id: 83, name: '炒饭（1份）', category: '主食', calories: 380, protein: 12.0, carbs: 52.0, fat: 14.0 },
  { id: 84, name: '炒面（1份）', category: '主食', calories: 420, protein: 15.0, carbs: 58.0, fat: 15.0 },
  { id: 85, name: '寿司（8个）', category: '主食', calories: 350, protein: 12.0, carbs: 65.0, fat: 3.0 },
  { id: 86, name: '鸡汤（1碗）', category: '汤', calories: 80, protein: 8.0, carbs: 2.0, fat: 4.0 },
  { id: 87, name: '蔬菜汤（1碗）', category: '汤', calories: 50, protein: 2.0, carbs: 8.0, fat: 1.0 },
  { id: 88, name: '排骨汤（1碗）', category: '汤', calories: 150, protein: 12.0, carbs: 3.0, fat: 10.0 },
  { id: 89, name: '蜂蜜（1勺约20g）', category: '其他', calories: 64, protein: 0.1, carbs: 17.0, fat: 0.0 },
  { id: 90, name: '橄榄油（1勺约15ml）', category: '其他', calories: 119, protein: 0.0, carbs: 0.0, fat: 13.5 },
  { id: 91, name: '南瓜（100g）', category: '蔬菜', calories: 26, protein: 1.0, carbs: 5.3, fat: 0.1 },
  { id: 92, name: '茄子（100g）', category: '蔬菜', calories: 25, protein: 1.1, carbs: 4.9, fat: 0.2 },
  { id: 93, name: '豆角（100g）', category: '蔬菜', calories: 30, protein: 2.0, carbs: 5.0, fat: 0.2 },
  { id: 94, name: '芒果（1个约200g）', category: '水果', calories: 120, protein: 1.6, carbs: 30.0, fat: 0.8 },
  { id: 95, name: '火龙果（100g）', category: '水果', calories: 51, protein: 1.1, carbs: 13.3, fat: 0.2 },
  { id: 96, name: '柚子（100g）', category: '水果', calories: 42, protein: 0.8, carbs: 10.6, fat: 0.2 },
  { id: 97, name: '木瓜（100g）', category: '水果', calories: 43, protein: 0.6, carbs: 10.9, fat: 0.3 },
  { id: 98, name: '榴莲（100g）', category: '水果', calories: 147, protein: 2.6, carbs: 27.1, fat: 3.4 },
];

function getFoodsByCategory(cat) { return FOOD_DATABASE.filter(f => f.category === cat); }
function searchFoods(kw) {
  if (!kw) return FOOD_DATABASE;
  const k = kw.toLowerCase();
  return FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(k));
}

// Calculator utilities
function calculateBMI(weight, height) {
  if (!weight || !height) return null;
  return Math.round(weight / ((height / 100) ** 2) * 10) / 10;
}
function getBMIStatus(bmi) {
  if (!bmi) return '未知';
  if (bmi < 18.5) return '偏瘦';
  if (bmi < 24) return '正常';
  if (bmi < 28) return '偏胖';
  return '肥胖';
}
function calculateMacroRatio(protein, carbs, fat) {
  const pc = protein * 4, cc = carbs * 4, fc = fat * 9;
  const total = pc + cc + fc;
  if (total === 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round(pc / total * 100),
    carbs: Math.round(cc / total * 100),
    fat: Math.round(fc / total * 100)
  };
}
function calculateExerciseCalories(type, duration, weight) {
  const met = { '跑步': 8.0, '快走': 4.5, '骑行': 6.0, '游泳': 7.0, '瑜伽': 3.0, '健身': 5.5, '跳绳': 10.0, '打篮球': 6.5, '打羽毛球': 5.5, '爬山': 7.5 };
  return Math.round((met[type] || 5.0) * (weight || 60) * duration / 60);
}
