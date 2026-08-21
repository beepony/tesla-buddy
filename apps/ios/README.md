# iOS App 骨架

此目录使用 XcodeGen 定义 iOS 17+ 的 SwiftUI 项目，已包含可请求本地演示 API 的总览页。

当前 Mac 尚未安装完整 Xcode，因此没有生成或验证 `.xcodeproj`。安装 Xcode 与 XcodeGen 后执行：

```sh
cd apps/ios
xcodegen generate
open TeslaCompanion.xcodeproj
```

真机默认先访问 `http://m4.local:8787`，局域网不可用时自动回退到 Tailscale HTTPS 地址。在 iOS Simulator 中使用 `127.0.0.1:8787`。

首次构建前，将 `Config/LocalSecrets.swift.example` 复制为 `Sources/LocalSecrets.swift`，并把 `apiToken` 设置为与根目录 `.env` 中 `TESLA_BUDDY_API_TOKEN` 完全相同的高强度随机值。真实的两个配置文件均不得提交到 Git。
