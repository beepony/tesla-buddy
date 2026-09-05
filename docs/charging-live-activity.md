# 充电实时活动（Build 23）

充电页顶部显示 TeslaMate 当前充电状态、百分比、连接时长、功率和充入电量。
打开“灵动岛与锁屏”后，App 在前台发现新鲜的正在充电记录时创建 ActivityKit 实时活动。
收起时显示闪电和百分比，展开及锁屏显示连接时长、功率和进度条。

## 当前免费 Apple ID 的限制

- App 活跃时每次请求结束后间隔 15 秒刷新；返回 App 时立即刷新。
- 本版未配置 APNs，不支持 App 挂起后的电量持续更新或自动开始。
- 锁屏保留最近读数；采样超过 120 秒后标记待刷新，计时不会无限延长。
- 点击实时活动打开 App 后获取新状态；未获取新数据之前不能保证知道车辆已经停止充电。
- 后续若升级付费开发者会员，可接入服务端 ActivityKit 推送；当前不需要推送凭据。

## 数据定义

`GET /v1/vehicles/:id/charging-status` 使用现有 Bearer 鉴权，返回最近充电过程。
无记录返回 `data: null`。从 `charging_processes` 取开始和结束时间，
从其最近一条 `charges` 采样取百分比、功率、充入电量和采样时间。
已结束、正在充电、零功率、缺失采样及采样过期分别处理。
计时是本次连接时长，包含暂停，不代表净充电工作时间。
当前 TeslaMate 数据库不存储目标百分比，因此不猜测充电上限或预计充满时间。
进度条表示当前电池电量占 100%，并非本次充电任务完成率。

## 验证

运行 `npm test` 验证状态映射、断流过期、结束、鉴权和空记录。
使用 XcodeGen 生成工程后构建主 App 和 ChargingWidget 扩展。
真机验收：开始充电→打开充电页→打开开关→回主屏幕/锁屏→检查展开视图；
超过两分钟不返回 App 应提示待刷新；返回 App 更新后结束充电应结束对应活动。
设备当前没有进行中的充电时，不应创建假的活动。

Apple 文档：https://developer.apple.com/documentation/ActivityKit/starting-and-updating-live-activities-with-activitykit-push-notifications
