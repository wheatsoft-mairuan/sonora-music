# 声屿 SONORA · 接手指南

## 快速启动

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # 产物在 dist/
npm run preview   # 预览生产构建，端口 4173
```

Node 版本建议 22+（本机验证用 v24.19.0）。核心依赖：`mdui@2.1.5`、`vite@8.3.8`。

## 接口代理（重要）

上游 `music-api.gdstudio.xyz` 已不再返回 `Access-Control-Allow-Origin`，浏览器直连会被 CORS 拦死（搜索 0 条、无播放地址）。现在前端只请求同源 `/gdapi/api.php`：

- `vite.config.js` 把 `/gdapi/*` 转发到 `SONORA_API_ORIGIN`（默认上游），`server` 与 `preview` 都配了。
- 静态托管 `dist/` 时必须在服务器上加同样的反代；否则用 `VITE_API_BASE=https://.../api.php` 构建。
- 直接用 `file://` 打开或不经代理的静态站点会重现 CORS 报错，这是预期行为，不是应用 bug。

## 代码入口

- `src/main.js`：应用状态、视图渲染、播放器、搜索、收藏、队列、设置。
- `src/styles.css`：MD3 tokens、三栏 shell、黑胶 Hero、播放器与全部响应式样式。
- `src/api.js`：第三方音乐接口封装，含超时、缓存、一次 503/网络错误重试。
- `src/data.js`：品牌常量、精选歌单、心情/曲风、回退曲目、榜单 ID。
- `src/icons.js` + `src/icons/`：本地 Material Symbols SVG sprite，无 CDN。
- `screenshots/`：桌面、手机、亮暗主题、设置、搜索、队列验收截图。

## 已验证

- 1440 / 1280 / 1024 / 840 / 560 / 390 六档布局无横向溢出。
- 深色、浅色、跟随系统；搜索、收藏、队列、设置弹窗、移动端全屏播放 sheet。
- `npm run build` 通过，`dist/` 可直接静态托管（需配 `/gdapi` 反代，见上）。
- 经代理后真实播放可用：Chrome 无头实例中 `audio.paused=false`、`readyState=4`，歌词 104 行、队列 200 项、封面死链 0。

## 已知限制

- 在线曲库使用第三方聚合接口 `music-api.gdstudio.xyz`，可能间歇 503；前端已重试一次并提示中文错误。正式部署建议替换为自有稳定音源。
- 上一版验收用的 headless Firefox 不含 MP3 解码器，测不出真实出声；现改用本机 Chrome（`--headless=new` + CDP，见 `scripts/verify.mjs`）实测可播放。
- `scripts/` 下的截图/冒烟脚本依赖 `playwright-core`（未列入 package.json，可用 `npm install --no-save playwright-core` 临时安装）。Chromium 在受限沙箱里 `spawn EPERM`，需先手动起 `chrome --remote-debugging-port=9222` 再 `connectOverCDP`；`browser.newPage()` 在 CDP 下不可用，改走 `browser.contexts()[0].newPage()`。
