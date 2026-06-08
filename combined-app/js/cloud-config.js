'use strict';
// ===================== 云同步配置 =====================
// 在 LeanCloud 国际版控制台 (https://console.leancloud.app) 创建应用后，
// 进入「设置 → 应用凭证」，把下面三项换成你自己的值。
// 注意：这三个值属于公开凭证（类似 Firebase 的 web config），
// 可以随代码一起提交到 GitHub，数据安全由账号登录 + ACL 保证。
const CLOUD_CONFIG = {
  appId: '',      // App ID
  appKey: '',     // App Key
  serverURL: ''   // REST API 服务器地址，形如 https://xxxxxxxx.api.lncldglobal.com
};
