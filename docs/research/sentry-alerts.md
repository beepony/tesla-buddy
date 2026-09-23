# 哨兵模式触发提醒调研

- 调研日期：2026-09-23
- 适用项目：Tesla Buddy（TeslaMate + 本地 API + iOS App）
- 问题：哨兵模式被触发时，iPhone 能否收到提醒；Tesla Buddy 能否通过现有数据库或 MQTT 订阅实现。

## 结论

**Tesla 官方 App 可以在部分哨兵安全事件发生时提醒手机。当前 Tesla Buddy 不能提醒哨兵触发；只订阅 TeslaMate 的 `sentry_mode` 也不足以做到。** 该字段表示哨兵模式是否启用，而不是一条安全事件。Tesla 官方 Fleet Telemetry 另有更细的哨兵状态枚举，为自建提醒提供可能，但需要一条新的官方遥测接入和可靠推送链路。

| 路径 | 可获得的信息 | 能否提醒“触发” | 时效与工作量 |
| --- | --- | --- | --- |
| Tesla 官方 App | 车辆识别的部分哨兵安全事件 | 可以；按 Tesla 自身的触发规则 | 现成方案；不是每段哨兵录像都提醒 |
| TeslaMate PostgreSQL / MQTT | 当前记录和 `sentry_mode` 开关状态 | 单靠现有字段不可以 | 可用于展示开关状态，不能推断报警 |
| Tesla Fleet Telemetry | `Sentry Mode` 状态枚举，含 `Aware`、`Panic` | 有技术路径，需实车验证状态与通知时机 | 需单独接入官方遥测、事件处理和手机推送 |

## 1. Tesla 官方手机提醒的范围

[Tesla Model Y 车主手册的 Sentry Mode 章节](https://www.tesla.com/ownersmanual/modely/en_us/GUID-56703182-8191-4DAE-AF07-2FDC0EB64663.html)明确说：哨兵模式只在警报触发、有人尝试打开车门或后备箱、或车辆检测到突然的剧烈动作时向手机 App 发通知。如果某个事件未被判定为明确威胁，车辆会保存录像，但不会触发警报。手册也说明车辆、地区、配置和软件版本可能影响可用功能。因此这里的“触发提醒”不等于“每次录制哨兵片段都提醒”。

对于希望立即知道明显安全事件的用户，先启用车辆哨兵模式并检查 Tesla 官方 App 的通知权限，是现成且直接的做法。Tesla Buddy 不应声称能比车辆官方判定更完整地发现威胁。

## 2. Tesla Buddy 目前的实际能力

本仓库的 [`SoftwareUpdateMonitor`](../../apps/api/src/software-updates.mjs) 只订阅 `version`、`update_available`、`update_version` 和 `healthy`；[`PostgresRepository`](../../apps/api/src/postgres-repository.mjs) 的车辆概览查询也没有哨兵事件字段。iOS 的 [`SoftwareUpdateNotifier`](../../apps/ios/Sources/SoftwareUpdateNotifier.swift) 只处理软件更新，设置界面当前只提供软件更新通知。因此，当前版本 **没有哨兵触发提醒开关，也不会发这类通知**。

TeslaMate 的 [MQTT 主题表](https://docs.teslamate.org/docs/integrations/mqtt/#mqtt-topics)将 `teslamate/cars/$car_id/sentry_mode` 描述为“哨兵模式是否处于启用状态”，示例值为 `false`；该主题表没有列出哨兵事件或警报主题。它可以回答“模式是否开着”，不能回答“此刻是否有人触发哨兵”或“是否产生了新录像”。给现有订阅器增加这个主题，最多能做开关状态展示或开关变化提醒，不能把 `true` 当作一次报警。

即使拿到了触发事件，当前 iOS 通知链路也不能保证及时送达。软件更新提醒通过 App 前台刷新或由 iOS 决定何时运行的后台刷新任务来发现新状态；后台任务的最早请求时间设在 45 分钟后，实际执行时间没有保证。当前工程没有 APNs 远程推送接入，详见 [`SOFTWARE_UPDATES.md`](../SOFTWARE_UPDATES.md) 与 [`TeslaCompanionApp.swift`](../../apps/ios/Sources/TeslaCompanionApp.swift)。哨兵安全提醒若需要及时送达，不能沿用这条尽力而为的本地轮询路径。

## 3. 官方遥测提供的另一条技术路径

Tesla [Fleet Telemetry 可用数据表](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data#vehicle-data)将 `Sentry Mode` 定义为“哨兵模式当前状态”的枚举；[官方 `vehicle_data.proto`](https://github.com/teslamotors/fleet-telemetry/blob/main/protos/vehicle_data.proto)的 `SentryModeState` 列有 `Unknown`、`Off`、`Idle`、`Armed`、`Aware`、`Panic`、`Quiet`。这比 TeslaMate MQTT 的布尔开关丰富，原则上可以在状态变化时形成候选事件。官方资料没有给 `Aware` 和 `Panic` 提供足以直接映射到“每次录像”或“每次手机警报”的自然语言定义。

但状态枚举不是已经交付到 Tesla Buddy 的报警通知。Tesla 的 [Fleet Telemetry 接入说明](https://developer.tesla.com/docs/fleet-api/fleet-telemetry#server-setup)要求接收服务器可从公网访问；[前提条件](https://developer.tesla.com/docs/fleet-api/fleet-telemetry#prerequisites)涉及受支持的车端固件、虚拟钥匙配对和车端配置。这与 Tesla Buddy 当前只连接本地 TeslaMate、没有 Tesla 登录令牌的架构不同。要使用它，需要单独建立官方遥测接入、记录事件时间并去重，再从服务器向 iPhone 发 APNs 远程推送。

Tesla [系统行为说明](https://developer.tesla.com/docs/fleet-api/fleet-telemetry#system-behavior)还指出，字段按值变化和配置的发送间隔上报，短暂状态可能不被送达；断线后缓冲补发也可能造成延迟。`Aware` 与 `Panic` 到底对应哪些实际场景、是否每次都上报、上报延迟多大，以及和官方 App 通知的对应关系，都要在目标车辆上实测，不能直接承诺“每次触发必达”。

## 建议

1. **现在需要手机提醒：**先使用 Tesla 官方 App 的哨兵通知，并用一次可控测试确认该车、该地区和当前通知设置的行为。
2. **Tesla Buddy 短期改进：**如需要，可在概览显示 `sentry_mode` 的当前开关状态，但文案只能叫“哨兵模式已开启/关闭”，不能叫“哨兵触发”。
3. **Tesla Buddy 自建触发提醒：**以 Fleet Telemetry 状态为候选数据源，先做实车事件对照验证，再设计服务端事件去重、APNs 推送、通知分类开关和断线/数据过期提示。这是新的数据接入与推送功能，不是往现有 MQTT 订阅数组里加一个字段即可完成。

## 来源与核验边界

- Tesla 官方：[Model Y Sentry Mode 车主手册](https://www.tesla.com/ownersmanual/modely/en_us/GUID-56703182-8191-4DAE-AF07-2FDC0EB64663.html)、[Fleet Telemetry 可用数据](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data)、[Fleet Telemetry 概览与接入条件](https://developer.tesla.com/docs/fleet-api/fleet-telemetry)、[Fleet Telemetry protobuf](https://github.com/teslamotors/fleet-telemetry/blob/main/protos/vehicle_data.proto)。
- TeslaMate 官方：[MQTT 集成文档](https://docs.teslamate.org/docs/integrations/mqtt/)。
- Tesla Buddy 当前实现：[`software-updates.mjs`](../../apps/api/src/software-updates.mjs)、[`postgres-repository.mjs`](../../apps/api/src/postgres-repository.mjs)、[`SoftwareUpdateNotifier.swift`](../../apps/ios/Sources/SoftwareUpdateNotifier.swift)、[`SOFTWARE_UPDATES.md`](../SOFTWARE_UPDATES.md)。
- 以上结论是公开文档与当前代码的能力判断；尚未连接本车进行哨兵事件实测，也没有测量 Fleet Telemetry 到手机的实际延迟。
