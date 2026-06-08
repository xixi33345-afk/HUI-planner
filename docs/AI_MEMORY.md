# AI_MEMORY.md

项目长期记忆。AI 在工作中获得的重要信息记录在此，供后续会话复用。

## 项目概况

- 用途：个人计划打卡 + 减重进度记录网站（PWA「健康打卡」）
- 技术栈：纯静态 HTML/CSS/JS，无构建工具，Chart.js 画图，service worker 离线缓存
- 结构：`index.html` 入口；`js/app.js` 导航+云同步+我的页面；`js/planner.js` 打卡；`js/health.js` 健康/体重/饮食；`js/ai-plan.js` AI 计划；`js/foods.js` 食物库；`js/cloud-config.js` 云服务凭证
- 数据：localStorage 为主存储（键：`planner_*`、`health_*`、`app_ai_plan`），登录后整体同步到 LeanCloud `AppData` 表
- 部署：GitHub Pages，见 `docs/部署指南.md`

## 约定与偏好

- 全部 JS 为无模块全局脚本，加载顺序在 index.html 中有要求
- UI 文案使用中文；toast 用 `healthShowToast()`
- 数据变更后调 `window.app.onDataChanged()` 触发自动云同步
- 用户（Ngozi）偏好简洁直接的回复

## 重要决策

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-06-04 | 云同步用 LeanCloud 国际版而非 Firebase | 需大陆+海外都可访问，Firebase 在大陆被墙；LeanCloud SDK 项目原本已集成 |
| 2026-06-04 | 账号体系：邮箱+密码（AV.User，username=email），数据按 owner+ACL 隔离 | 不依赖 Google 账号，大陆用户可注册 |
| 2026-06-04 | 首次登录自动迁移本地 localStorage 数据到云端；登录后以云端为准 | 保留用户已有记录 |
| 2026-06-04 | UI 大改：渐变收敛（只留体重卡，--grad-* 指向纯色实现）、白色毛玻璃头部、主导航移到底部、子页签为 #subTabs 分段控件 | 大气简洁 + 标准移动端模式 |
| 2026-06-04 | 依赖加载：js/vendor/ 本地优先 → jsdelivr → bootcdn → unpkg 四级降级（npm 在沙盒被禁，无法代下载） | 大陆 CDN 可靠性 |
| 2026-06-04 | 原生 confirm/alert 全部替换为 healthConfirm/healthShowToast；导入改三选项弹层，替换需二次确认 | 统一体验，消除危险默认 |
| 2026-06-08 | 部署改用 Cloudflare Pages（仓库名 HUI-planner，域名 hui-planner.pages.dev）；GitHub Pages 在大陆被墙弃用 | 大陆不开 VPN 访问 |
| 2026-06-08 | 云同步弃用 LeanCloud（国际版停注册+共享域名不再服务大陆），改为 Cloudflare Pages Functions + KV 自建后端 | 同域名、大陆可用、无第三方 |
| 2026-06-08 | 后端 functions/api/[[path]].js：邮箱+密码（加盐SHA-256），HMAC token 30天，KV 绑定名 DB，密钥存 KV __secret 或 env.AUTH_SECRET。前端 CloudSync 改 fetch /api。移除 AV SDK 和 cloud-config.js | — |
