# 本地开发与 TeslaMate 接入

## 当前可运行的演示模式

本项目没有 npm 依赖。需要 Node.js 22+：

```sh
cp .env.example .env
npm start
curl http://127.0.0.1:8787/v1/vehicles
npm test
```

默认只监听 `127.0.0.1`，不会被局域网设备访问。演示数据仅用于开发 UI，绝不代表车辆真实状态。

## 真实 TeslaMate 接入前检查

1. 安装并启动 Docker Desktop（或其他 Docker 运行时），确认现有 TeslaMate stack 正常运行。
2. 记录 TeslaMate 镜像/版本与 PostgreSQL 主版本，先做数据库备份；TeslaMate 当前官方版本有最低 PostgreSQL 版本要求，请以官方发布说明为准。
3. 使用数据库管理员创建专用、只读的登录角色；不得将应用连接串设为 TeslaMate 所有者或超级用户。
4. 对真实数据库运行只读 schema 盘点，确认 `cars`、`positions`、`drives`、`charging_processes` 等实际可用的表和列，再实现 PostgreSQL 适配器与契约测试。
5. 为本项目的用户标注、费用与配对信息建立独立 schema/数据库；不要修改 TeslaMate 的表。
6. 完成配对和 TLS 之前，保持 API 仅绑定 loopback 地址。远程访问使用 Tailscale/WireGuard 等私有网络，不将 PostgreSQL 或 API 直接映射到公网。

## iOS 开发前置条件

当前 Mac 仅安装了 Command Line Tools，尚未安装完整 Xcode。安装 Xcode 后，使用 iOS 17+ Simulator 或真机运行 `apps/ios` 中的 SwiftUI 工程（下一阶段生成）。真机、通知和 TestFlight 还需要 Apple Developer 签名。
