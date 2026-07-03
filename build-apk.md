# Android APK 构建指南

本项目使用 Capacitor 将 HTML5 游戏打包为 Android APK。

## 方法一：本地构建（需要 Android Studio）

### 1. 安装依赖

```powershell
# 需要 Java JDK 17+
# 需要 Android Studio (包含 Android SDK)
npm install -D @capacitor/core @capacitor/cli @capacitor/android
```

### 2. 准备 web 资源

```powershell
# 把所有 HTML/CSS/JS 资源复制到 www 目录
mkdir www -Force
Copy-Item standalone.html, simple.html, realistic.html, manifest.json, sw.js, icon-192.png, icon-512.png www/
# 重命名 standalone.html 为 index.html（作为应用入口）
Copy-Item www/standalone.html www/index.html
```

### 3. 添加 Android 平台

```powershell
npx cap add android
npx cap sync
```

### 4. 用 Android Studio 构建

```powershell
npx cap open android
# 在 Android Studio 中:
# Build → Build Bundle(s)/APK(s) → Build APK(s)
# 输出: android/app/build/outputs/apk/debug/app-debug.apk
```

## 方法二：使用 PWABuilder（推荐，无需本地环境）

1. 部署 `standalone.html`、`simple.html` 等文件到任意静态托管
   （例如 GitHub Pages、Netlify、Cloudflare Pages）
2. 访问 https://www.pwabuilder.com/
3. 输入你的网站 URL
4. 点击 "Package for Stores" → Android → 下载 APK

## 方法三：GitHub Actions 自动构建（见 .github/workflows/build-apk.yml）

push 到 main 分支后会自动触发构建，并在 Release 中发布 APK。

## 应用信息

- 应用 ID: `com.skymoon.humantool`
- 应用名: 人类工具进化史
- 入口页: `standalone.html`
- 最低 Android 版本: Android 7.0 (API 24)
- 目标 Android 版本: Android 14 (API 34)
