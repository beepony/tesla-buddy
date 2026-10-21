# Tesla Buddy

当前版本：**2.0.0 (33)**

本版更新：改造为微信小程序，保留全部功能和数据，界面按微信设计规范重做，软件更新改用微信订阅消息提醒。完整记录见 [更新日志](CHANGELOG.md)。

Tesla Buddy 是一套本地优先的私人 Tesla 数据助手。它从家中 Mac mini 上运行的 TeslaMate 读取数据，通过受保护的 API 提供给微信小程序，不保存 Tesla 登录令牌，也不会直接控制车辆。

由于 iOS 个人开发者签名限制较多，自 2.0 起主力客户端为微信小程序（`apps/miniprogram`）；原生 iOS App 停止发布，源码保留在 `apps/ios`。

## 功能

- 概览：车辆状态、电量、续航、四轮胎压、累计里程和最后同步时间。
- 车辆软件更新：显示当前系统版本；本车收到 OTA 更新后提示目标版本和更新方法，并可通过微信订阅消息提醒。
- 行程：按日期浏览驾驶记录和足迹地图，在详情地图中查看实际行驶轨迹、出发地与到达地点，并查看距离、时间、能耗和温度。
- 充电：查看实时充电状态，按月汇总充入电量、充电时长和费用，并按日历或列表浏览每天的充电记录。
- 停车：查看当前及历史停车时长和地点。
- 报告：在“我的 > 用车报告”中汇总周期里程、能耗、充电量和使用成本。
- 我的与设置：集中提供用车报告和偏好设置，包括软件更新订阅、充电卡片与屏幕常亮，以及服务中心 Wi-Fi（「我的 > 设置 > 服务中心」：一键加入「Tesla Service」，也可复制密码手动连接）。

## 架构

```text
Tesla 车辆
    ↓
TeslaMate ── PostgreSQL（只读）── Tesla Buddy API ── 微信小程序
    └────── MQTT（更新状态）───────┘        └── 微信订阅消息（更新提醒）
```

数据库和 MQTT 只监听本机地址。小程序要求 HTTPS 合法域名，API 需经反向代理或 Tailscale Funnel 以 HTTPS 暴露，并始终由 API token 保护。

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

## 微信小程序

底部导航为“概览”“行程”“充电”“停车”“我的”。配置与发布步骤见 [apps/miniprogram/README.md](apps/miniprogram/README.md)：

```sh
cp apps/miniprogram/config.example.js apps/miniprogram/config.js   # 填写 HTTPS 地址与 API token
```

然后用微信开发者工具导入 `apps/miniprogram`，填写自己的 AppID 即可预览、真机调试和上传体验版。

## 旧版 iOS App

源码保留在 `apps/ios`，不再随版本发布。需要时可在 `apps/ios` 运行 `xcodegen generate` 后用 Xcode 构建，或用 `npm run ipa` 导出本地安装包（内含 API token，切勿外传）。

## 软件更新检测

API 订阅 TeslaMate 的 `version`、`update_available`、`update_version` 和 `healthy` MQTT 主题：车辆上报的目标版本高于已安装版本时显示“有更新”。TeslaMate 的 `update_available` 只覆盖部分更新状态（已下载待安装等会返回无更新），因此不能单独依赖它；断线或数据不足时显示“更新状态未知”，避免根据互联网版本号误报。

在「我的 > 设置 > 通知」订阅后，服务器检测到新目标版本会发送微信订阅消息，同一版本只提醒一次；需在 `.env` 配置 `WECHAT_*` 变量。更新安装仍需在 Tesla 官方 App 或车机的“控制 > 软件”中完成。详细接入、状态规则与通知时机见 [docs/SOFTWARE_UPDATES.md](docs/SOFTWARE_UPDATES.md)。

## 测试

```sh
npm test   # API 与小程序工具函数
```

## 文档

- [微信小程序配置与发布](apps/miniprogram/README.md)
- [版本管理与发布流程](docs/VERSIONING.md)
- [版本更新日志](CHANGELOG.md)
- [历史版本发布记录](https://github.com/beepony/tesla-buddy/releases)
- [产品需求说明](docs/PRD.md)
- [本地开发与 TeslaMate 接入](docs/LOCAL_SETUP.md)
- [车辆软件更新提示](docs/SOFTWARE_UPDATES.md)
- [哨兵模式触发提醒调研](docs/research/sentry-alerts.md)
- [Tesla 第三方 App 市场与公开发布评估](docs/research/tesla-third-party-apps.md)
- [电池健康度数据可用性调研](docs/research/battery-health-data.md)
- [报告口径](docs/REPORTS.md)
- [充电 Live Activity](docs/charging-live-activity.md)

## 隐私与安全

Tesla Buddy 面向个人自托管使用。不要将 PostgreSQL、MQTT 或未配置认证的 API 暴露到公网；不要提交 `.env`、数据库连接串、API token、`WECHAT_APP_SECRET`、`apps/miniprogram/config.js` 或 `LocalSecrets.swift`。
