# 声屿 SONORA · Android 壳说明

把网页版（Vite + mdui 纯前端 SPA）用 **Capacitor 8** 套成原生 App：WebView 加载打包好的
`dist/`，`https://localhost` 作为源，接口请求改走原生 HTTP 绕过 CORS。

## 产物

| 文件 | 说明 |
| --- | --- |
| `声屿SONORA-1.0-debug.apk` | 当前可安装包（debug 签名，4.3 MB） |
| `android/app/build/outputs/apk/debug/app-debug.apk` | Gradle 的原始输出 |

安装：把 APK 传到手机点开安装（需允许「未知来源」），或手机开 USB 调试后
`adb install -r 声屿SONORA-1.0-debug.apk`。

要求 **Android 7.0（API 24）及以上**，targetSdk 36。

## 重新构建

双击 `build-apk.cmd`（内部用 `-ExecutionPolicy Bypass` 调 `build-apk.ps1`，不改系统策略），
或者手工两步：

```powershell
npm run build:android     # vite build --mode android && cap sync android
cd android; .\gradlew.bat assembleDebug
```

Gradle 需要 JDK 21（本机系统装的是 JDK 25，Gradle 8.14 用不了），脚本会自动把
`..\.tools\jdk21`、`..\.tools\android-sdk`、`..\.tools\gradle-home` 指给构建。

## 为「跑在 App 里」做的改动

| 位置 | 改动 | 原因 |
| --- | --- | --- |
| `capacitor.config.json` | `plugins.CapacitorHttp.enabled = true` | 上游接口不发 CORS 头，浏览器 fetch 会被拦；开启后 `window.fetch` 走原生请求 |
| `.env.android` | `VITE_API_BASE=https://music-api.gdstudio.xyz/api.php` | App 里没有 vite 的 `/gdapi` 代理，必须直连绝对地址 |
| `package.json` | `build:android` / `android:open` / `android:apk` | 构建脚本入口 |
| `src/api.js` | 超时改成 `Promise.race(fetch, abort)` | CapacitorHttp 改写的 fetch 不认 `AbortSignal`，只 abort 停不下来 |
| `MainActivity.java` | API 35+ 给内容视图加 systemBars + IME 内边距 | Android 15 起 targetSdk 35+ 强制 edge-to-edge，页面没有 safe-area 可用 |
| `values/styles.xml`、`values/colors.xml` | 启动窗口/状态栏底色 `#0D1613` | 避免深色 App 启动时白闪 |
| `res/mipmap-*`、`res/drawable*/splash.png` | 按 `public/favicon.svg` 几何重绘（`.tools/dl/make_icons.py`） | 品牌图标 + 自适应图标 + 启动图 |
| `app/build.gradle` | `buildToolsVersion = '36.0.0'` | AGP 默认要 35.0.0，本机只备了 36.0.0 |
| `gradle.properties` | `org.gradle.vfs.watch=false` | 受限环境下文件监视线程会报 `Couldn't open current thread` |
| `AndroidManifest.xml` | `android:usesCleartextTraffic="true"` | 允许个别 http 音源，https 接口不受影响 |

## 已知限制

- **debug 签名**：只能自用/内测。上架或分发需要 `keytool` 生成 keystore，在 `app/build.gradle`
  配 `signingConfigs`，再用 `assembleRelease` 或 `bundleRelease` 出 AAB。
- 接口可用性完全取决于 `music-api.gdstudio.xyz`，它挂了这个壳里的在线曲库也一起不可用
  （App 里没有本地降级服务）。
- CapacitorHttp 不支持流式响应和 `AbortSignal`（已用 race 兜住超时）。
- 没有做后台播放/通知栏控制：切到别的 App 时 WebView 音频的行为由系统决定，未验证。
- 本机无模拟器/真机，只在构建与静态资源层面验证过；真机上装一次看效果最稳。
