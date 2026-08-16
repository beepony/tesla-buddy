# iOS App 骨架

此目录使用 XcodeGen 定义 iOS 17+ 的 SwiftUI 项目，已包含可请求本地演示 API 的总览页。

当前 Mac 尚未安装完整 Xcode，因此没有生成或验证 `.xcodeproj`。安装 Xcode 与 XcodeGen 后执行：

```sh
cd apps/ios
xcodegen generate
open TeslaCompanion.xcodeproj
```

在 iOS Simulator 中，`127.0.0.1` 指向模拟器自身，不是 Mac mini。运行时应将 `TeslaCompanionApp.swift` 中的 API 基址改为 Mac mini 的局域网 IP 或通过模拟器的本机映射配置；在实现设备配对前，API 必须保持在受信任网络中。
