/**
 * 是否运行在 uni-app 外壳的 web-view 里。
 * 两个依据：外壳加载的 URL 带 shell=app 参数（apps/uni/pages/index/index.vue），
 * 或 UA 含 Html5Plus（uni app-plus 环境的 webview UA 特征，作为兜底）。
 * 启动时读取一次即可——SPA 路由切换不会改变判断结果。
 */
export const inAppShell =
  new URLSearchParams(window.location.search).has('shell') ||
  /Html5Plus/i.test(window.navigator.userAgent)
