# Tesla Buddy

当前版本：**1.1.0 (24)**

Tesla Buddy 是一套本地优先的私人 Tesla 数据助手。它从家中 Mac mini 上运行的 TeslaMate 读取数据，通过受保护的本地 API 提供给原生 iOS App，不保存 Tesla 登录令牌，也不会直接控制车辆。

## 功能

- 概览：车辆状态、电量、续航、累计里程和最后同步时间。
- 车辆软件更新：显示当前系统版本；本车收到 OTA 更新后提示目标版本和更新方法。
- 行程：按日期浏览驾驶记录，查看距离、时间、能耗、温度与起终点。
- 充电：查看实时充电状态、历史记录、功率、效率和费用。
- 停车：查看当前及历史停车时长和地点。
- 报告：汇总周期里程、能耗、充电量和使用成本。
- Live Activity：充电时在锁屏和灵动岛显示进度。

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

将 `apps/ios/Config/LocalSecrets.swift.example` 复制到 `apps/ios/Sources/LocalSecrets.swift`，填入与服务端一致的 API token，然后生成并打开工程：

```sh
cd apps/ios
xcodegen generate
open TeslaCompanion.xcodeproj
```

工程目标为 iOS 17+。选择自己的开发团队和已连接的 iPhone 后即可编译安装。

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

- [产品需求说明](docs/PRD.md)
- [本地开发与 TeslaMate 接入](docs/LOCAL_SETUP.md)
- [车辆软件更新提示](docs/SOFTWARE_UPDATES.md)
- [报告口径](docs/REPORTS.md)
- [充电 Live Activity](docs/charging-live-activity.md)

## 隐私与安全

Tesla Buddy 面向个人自托管使用。不要将 PostgreSQL、MQTT 或未配置认证的 API 暴露到公网；不要提交 `.env`、数据库连接串、API token 或 `LocalSecrets.swift`。
