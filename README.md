# Tesla Buddy

当前版本：**1.4.0 (28)**

本版更新：行程详情新增大尺寸轨迹地图，沿 TeslaMate 实际行驶轨迹标记出发地与到达地点；行程与充电统一使用月份汇总与分组卡片，充电记录可按日历或列表浏览。完整记录见 [更新日志](CHANGELOG.md)。

Tesla Buddy 是一套本地优先的私人 Tesla 数据助手。它从家中 Mac mini 上运行的 TeslaMate 读取数据，通过受保护的本地 API 提供给原生 iOS App，不保存 Tesla 登录令牌，也不会直接控制车辆。

iOS App 使用 SwiftUI Scene 生命周期，兼容 iOS 27 的前台窗口管理。

## 功能

- 概览：车辆状态、电量、续航、四轮胎压、累计里程和最后同步时间。
- 车辆软件更新：显示当前系统版本；本车收到 OTA 更新后提示目标版本和更新方法。
- 行程：按日期浏览驾驶记录，在详情地图中查看实际行驶轨迹、出发地与到达地点，并查看距离、时间、能耗和温度。
- 充电：查看实时充电状态，按月汇总充入电量、充电时长和费用，并按日历或列表浏览每天的充电记录。
- 停车：查看当前及历史停车时长和地点。
- 报告：在“我的 > 用车报告”中汇总周期里程、能耗、充电量和使用成本。
- 我的与设置：集中提供用车报告和 App 偏好设置。
- Live Activity：充电时在锁屏和灵动岛显示进度，可在“我的 > 设置 > 灵动岛与锁屏”中开启或关闭。

## 架构

```text
Tesla 车辆
    ↓
TeslaMate ── PostgreSQL（只读）── Tesla Buddy API ── iPhone App
    └────── MQTT（更新状态）───────┘
```

数据库和 MQTT 只监听本机地址。iPhone 在同一 Wi-Fi 下通过 `m4.local` 连接，外出时可经 Tailscale 私有网络访问。

## 本地运行

需要 Node.js 22+、Docker Desktop、Xcode 26+ 和 XcodeGen。

```sh
npm ci
cp .env.example .env
npm start
```

演示模式使用 `DATA_SOURCE=mock`。连接真实 TeslaMate 前，请建立专用 PostgreSQL 只读账号，并在 `.env` 配置 `TESLAMATE_DATABASE_URL`。所有 `/v1/` 数据接口均由 `TESLA_BUDDY_API_TOKEN` 保护。

启动完整 TeslaMate 环境：

```sh
docker compose --env-file infra/teslamate/.env \
  -f infra/teslamate/compose.yml up -d
```

## iOS App

App 的底部导航包含“概览”“行程”“充电”“停车”和“我的”。用车报告与设置统一收纳在“我的”中，避免底部菜单过多；充电页显示当前充电状态，并按月份汇总和浏览历史记录。

将 `apps/ios/Config/LocalSecrets.swift.example` 复制到 `apps/ios/Sources/LocalSecrets.swift`，填入与服务端一致的 API token，然后生成并打开工程：

```sh
cd apps/ios
xcodegen generate
open TeslaCompanion.xcodeproj
```

工程目标为 iOS 17+。选择自己的开发团队和已连接的 iPhone 后即可编译安装。

## 用 .ipa 安装到 iPhone

```sh
npm run ipa                      # 优先 Ad Hoc，账号无 Ad Hoc 权限时自动回退开发签名
npm run ipa -- --method ad-hoc   # 只导出 Ad Hoc
```

产物为 `build/ipa/TeslaBuddy-<版本>-<构建号>-<签名方式>.ipa`，安装方式：

1. 命令行安装到已注册设备：`xcrun devicectl device install app --device <UDID> build/ipa/xxx.ipa`
2. Apple Configurator：连接 iPhone 后把 .ipa 拖到设备上。
3. Xcode：`Window > Devices and Simulators` 中选择设备后添加安装包。

两种签名方式都只能安装到开发者账号中已注册 UDID 的设备（每年最多 100 台）。开发签名首次运行需要在 iPhone 的 设置 > 通用 > VPN与设备管理 中信任对应证书。Ad Hoc 分发要求付费 Apple Developer Program 会员；当前团队只有开发签名权限，脚本会自动回退并给出提示。

安装包内编有 API token 和 Tailscale 主机名，因此默认只保留在本地 `build/ipa`，不会随发布上传。确需上传时执行 `npm run release -- --upload-ipa`，此时仓库必须保持私有，并应把该 token 视为已暴露、及时轮换。

## 软件更新检测

API 订阅 TeslaMate 的 `version`、`update_available`、`update_version` 和 `healthy` MQTT 主题。它只在车辆明确报告可用更新时显示“有更新”，断线或数据不足时显示“更新状态未知”，避免根据互联网版本号误报。

更新安装仍需在 Tesla 官方 App 或车机的“控制 > 软件”中完成。详细接入和状态规则见 [docs/SOFTWARE_UPDATES.md](docs/SOFTWARE_UPDATES.md)。

## 测试

```sh
npm test
xcodebuild -project apps/ios/TeslaCompanion.xcodeproj \
  -scheme TeslaCompanion -sdk iphonesimulator \
  -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

## 文档

- [版本管理与发布流程](docs/VERSIONING.md)
- [版本更新日志](CHANGELOG.md)
- [历史版本发布记录](https://github.com/beepony/tesla-buddy/releases)
- [产品需求说明](docs/PRD.md)
- [本地开发与 TeslaMate 接入](docs/LOCAL_SETUP.md)
- [车辆软件更新提示](docs/SOFTWARE_UPDATES.md)
- [电池健康度数据可用性调研](docs/research/battery-health-data.md)
- [报告口径](docs/REPORTS.md)
- [充电 Live Activity](docs/charging-live-activity.md)

## 隐私与安全

Tesla Buddy 面向个人自托管使用。不要将 PostgreSQL、MQTT 或未配置认证的 API 暴露到公网；不要提交 `.env`、数据库连接串、API token 或 `LocalSecrets.swift`。
