# 车辆软件更新提示

概览中的「系统版本」会显示当前已安装版本，以及「有更新」「暂无更新」或「更新状态未知」。点击卡片可查看可用版本和 Tesla 官方更新指引。打开概览、App 回到前台、前台每 60 秒及手动刷新时会读取状态。安装或预约更新仍在 Tesla 官方 App 或车机「控制 > 软件」中完成。

## 数据来源

API 订阅 TeslaMate MQTT 的 `version`、`update_available`、`update_version`、`healthy`，以车辆实际收到的推送为准。Tesla 按车辆配置和地区分批发布软件；互联网上出现更高版本并不代表本车可安装。

`GET /v1/vehicles` 和 `GET /v1/vehicles/{id}/overview` 增加：

- `updateStatus`：`available` / `no_update` / `unknown`（未接入时也兼容原有 `unavailable`）。
- `availableSoftwareVersion`：可用版本；无更新或没有版本信息时为 `null`。
- `softwareUpdateReceivedAt`：MQTT 更新可用性消息的接收时间，**不是车辆检查更新时间**。

MQTT 可能重放保留消息，界面因此使用「上次同步」措辞。断线、订阅失败或日志服务报告不健康时返回未知。TeslaMate 的 `update_available` 只把 Tesla `software_update.status` 中的部分状态映射为 `true`（`available`、`downloading`、`downloading_wifi_wait`、`scheduled`、`installing`），已下载待安装等情况会得到 `false`；因此只要车辆上报的目标版本高于已安装版本，即使 `update_available` 为 `false` 也显示有更新。目标版本已安装时清除提示，保留消息不会覆盖数据库中更高的已安装版本。App 刷新失败时保留旧概览，并隐藏肯定的更新提示。

## 本地 Mac 接入

1. 安装新增依赖：`npm ci`。
2. `infra/teslamate/compose.yml` 已加入 `127.0.0.1:1883:1883`，并持久化 TeslaMate 的保留消息。重新创建 broker 以应用配置：

   ```sh
   docker compose --env-file infra/teslamate/.env -f infra/teslamate/compose.yml up -d mosquitto
   ```

3. 在根目录 `.env` 保持 `DATA_SOURCE=postgres`，增加：

   ```dotenv
   TESLAMATE_MQTT_URL=mqtt://127.0.0.1:1883
   TESLAMATE_MQTT_TOPIC_PREFIX=teslamate
   ```

4. 若配置了 TeslaMate 的 `MQTT_NAMESPACE`，主题前缀使用 `teslamate/<namespace>`；broker 需要认证时配置 `TESLAMATE_MQTT_USERNAME`、`TESLAMATE_MQTT_PASSWORD`。
5. 重启 API，并安装新构建的 iOS App。

MQTT 端口仅绑定本机，不开放到局域网或公网。未配置 MQTT 时其余 API 正常工作，更新状态保持未知。Mock 模式不会连接真实 broker。

## 验证

`npm test` 覆盖更新可用、目标版本高于已安装版本、缺少版本号、无更新、更新完成、旧保留消息、版本数字比较、多车隔离、命名空间、断线重连、订阅失败及 API 认证。iOS 可用以下命令验证：

```sh
xcodebuild -project apps/ios/TeslaCompanion.xcodeproj -scheme TeslaCompanion \
  -sdk iphonesimulator -configuration Debug -derivedDataPath /tmp/tesla-buddy-build \
  CODE_SIGNING_ALLOWED=NO build
```

消息来源：[TeslaMate MQTT 文档](https://docs.teslamate.org/docs/integrations/mqtt/)；更新操作：[Tesla 官方指南](https://www.tesla.com/support/software-updates)。
