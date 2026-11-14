# 声屿 SONORA —— 一键构建 Android debug APK
#
# 用法（在项目根目录）：  pwsh -File .\build-apk.ps1
# 产物：                  android\app\build\outputs\apk\debug\app-debug.apk
#
# 说明：本机没装 Android Studio，JDK21 / Android SDK / Gradle 缓存都放在
#       ..\.tools 下，脚本只负责把它们指给 Gradle，不改全局环境变量。
$ErrorActionPreference = 'Stop'

$root  = Split-Path -Parent $MyInvocation.MyCommand.Path
$tools = Join-Path (Split-Path -Parent $root) '.tools'

if (-not (Test-Path (Join-Path $tools 'jdk21'))) {
    throw "缺少 JDK：$tools\jdk21"
}
if (-not (Test-Path (Join-Path $tools 'android-sdk'))) {
    throw "缺少 Android SDK：$tools\android-sdk"
}

$env:JAVA_HOME         = Join-Path $tools 'jdk21'
$env:ANDROID_HOME      = Join-Path $tools 'android-sdk'
$env:ANDROID_SDK_ROOT  = $env:ANDROID_HOME
$env:GRADLE_USER_HOME  = Join-Path $tools 'gradle-home'
$env:ANDROID_USER_HOME = Join-Path $tools 'android-user'
$env:npm_config_cache  = Join-Path $tools 'npm-cache'
$env:PATH              = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

Push-Location $root
try {
    Write-Host '==> 1/2 打包网页（android 模式）并同步到 Android 工程' -ForegroundColor Cyan
    npm run build:android

    Write-Host '==> 2/2 Gradle 出 APK' -ForegroundColor Cyan
    Push-Location (Join-Path $root 'android')
    try {
        & .\gradlew.bat assembleDebug --console=plain
    } finally {
        Pop-Location
    }

    $apk = Join-Path $root 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (Test-Path $apk) {
        $mb = [math]::Round((Get-Item $apk).Length / 1MB, 2)
        Write-Host "完成：$apk（$mb MB）" -ForegroundColor Green
    }
} finally {
    Pop-Location
}
