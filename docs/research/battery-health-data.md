# Tesla Buddy 电池健康度数据可用性调研

- 调研日期：2026-09-11
- 适用项目：Tesla Buddy（iOS 17+ 原生 App + TeslaMate/PostgreSQL 本地 API）
- 结论性质：数据可用性与产品展示建议

## 结论先行

**当前数据链路没有 Tesla 官方给出的电池健康度（State of Health / SOH）百分比。** 可以展示 TeslaMate 数据推算出的“估算可用容量”和“估算容量趋势”，但不应把它无条件命名为“电池健康度”或用于保修判断。

Tesla 官方确实在部分车辆的车机中提供“电池健康”评估及最多 24 小时的 Battery Health Test。官方说明测试结果是电池相对新车状态的能量保持率，并结合 BMS 数据、具体电池类型、年龄和使用情况计算；车辆可能不具备此功能。这个结果目前只在车机使用流程中有官方说明。[Tesla Model Y Owner's Manual：High Voltage Battery Health](https://www.tesla.com/ownersmanual/modely/tr_tr/GUID-B9807218-7291-4F68-9AFF-7C525CF498F3.html)（访问于 2026-09-11；页面语言由地区路由决定）、[Tesla Model 3 Owner's Manual：High Voltage Battery Health](https://www.tesla.com/ownersmanual/model3/en_us/GUID-B9807218-7291-4F68-9AFF-7C525CF498F3.html)（访问于 2026-09-11）

Tesla 公开 Fleet Telemetry 字段中有电量百分比、可用 SOC、剩余标称能量、额定/理想/估算续航、电池包电压电流、单元压差和温度等信号，但字段清单及官方 protobuf 中没有 Battery Health、SOH、Nominal Full Pack 或车机 Battery Health Test 结果字段。[Tesla Fleet API：Available Data](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data)、[Tesla Fleet Telemetry：vehicle_data.proto](https://github.com/teslamotors/fleet-telemetry/blob/main/protos/vehicle_data.proto)（访问于 2026-09-11）

因此建议：

1. 当前概览页继续使用 **“估算可用容量”**（kWh），副文案明确“基于 TeslaMate 充电数据估算”。
2. 暂不新增一个看似官方的 **“电池健康度 xx%”**。如确需百分比，应要求用户提供“新车可用容量”基准，并标注为 **“估算容量保持率”**，同时展示样本数、估算日期和置信状态。
3. Tesla 官方车机 Battery Health Test 的结果只能让用户手动录入或截图留档；在公开 Fleet API 未新增对应字段前，不能承诺自动同步。

## 1. 当前项目的数据来源与已有值

真实数据模式下，本项目通过只读 PostgreSQL 连接直接查询 TeslaMate 数据库，而不是直接调用 Tesla Fleet API（见 [`apps/api/src/repository.mjs`](../../apps/api/src/repository.mjs) 与 [`.env.example`](../../.env.example)）。仓库部署配置使用 `teslamate/teslamate:latest`、PostgreSQL 和 Grafana（见 [`infra/teslamate/compose.yml`](../../infra/teslamate/compose.yml)）。

概览接口当前已经返回 `estimatedBatteryCapacityKwh`。其计算为：

```text
最近一次 SOC 增幅至少 10 个百分点的充电过程：
估算容量 = charge_energy_added / (end_battery_level - start_battery_level) × 100
```

实现位于 [`apps/api/src/postgres-repository.mjs`](../../apps/api/src/postgres-repository.mjs)，概览页当前以“电池容量 / 充电数据估算”展示，见 [`apps/ios/Sources/ContentView.swift`](../../apps/ios/Sources/ContentView.swift)。

这个值是**一次充电过程的线性外推**，不是 BMS 报告的完整电池容量，也不是 Tesla 官方 Battery Health Test 结果。它会受 SOC 取整、充电损耗/能量口径、缓冲区、温度、充电过程完整性和单次样本异常影响。尤其当前公式只取最近一个合格充电过程，没有平滑、离群值过滤或新车基准，因此不适合直接换算成健康度百分比。

## 2. TeslaMate 官方“Battery Health”实际如何计算

TeslaMate 官方 Battery Health Grafana dashboard 自己也把 degradation 描述为“estimated value”。它不是读取一个 SOH 字段，而是组合以下数据：

- 从合格充电过程推导车辆的额定能耗效率；筛选条件包含充电超过 10 分钟、结束 SOC 不高于 95%、存在起止额定续航且有充入能量。
- 用 `rated_battery_range_km × efficiency / usable_battery_level` 得到各样本容量。
- 当前容量取最近合格充电数据的平均；历史新车容量默认取记录期间最大值，也允许用户手工填写 `custom_kwh_new`。
- 健康度最终是“当前估算容量 ÷ 新车容量基准”，并限制在 100% 以内。

这些逻辑和限制都写在 TeslaMate 官方 dashboard 的说明与 SQL 中。[TeslaMate：battery-health.json，容量与健康度面板](https://github.com/teslamate-org/teslamate/blob/main/grafana/dashboards/battery-health.json#L46-L110)、[TeslaMate：battery-health.json，估算方法说明](https://github.com/teslamate-org/teslamate/blob/main/grafana/dashboards/battery-health.json#L583-L661)、[TeslaMate：battery-health.json，辅助查询](https://github.com/teslamate-org/teslamate/blob/main/grafana/dashboards/battery-health.json#L1707-L1721)（访问于 2026-09-11）

TeslaMate FAQ 也明确说明，其消费/效率数据因为上游 API 不直接提供而需基于充电记录估算；至少需要两次符合条件的充电，未来充电样本会改善估算。[TeslaMate FAQ](https://docs.teslamate.org/docs/faq/#why-are-no-consumption-values-displayed-in-grafana)（访问于 2026-09-11）

这意味着 TeslaMate 的 Battery Health 是一个**可用于观察长期趋势的统计估计**，不是车辆诊断值。若 TeslaMate 从车辆并非新车时才开始记录，历史最大容量也不能代表新车容量；没有可靠的新车基准时，百分比的分母并不可信。

## 3. Tesla Fleet API 能提供什么

Fleet Telemetry 的公开字段对电池相关功能仍有价值：

| 数据 | 官方含义 | 可否直接得到健康度 |
| --- | --- | --- |
| `BatteryLevel` / `Soc` | 总容量百分比 / 可用 SOC | 否；只是当前电量状态 |
| `EnergyRemaining` | 电池包剩余标称能量（kWh） | 否；没有新车基准，且不是健康度结果 |
| `RatedRange` / `IdealBatteryRange` / `EstBatteryRange` | 当前 SOC 下的不同续航口径 | 否；续航不是容量健康度 |
| `PackVoltage` / `PackCurrent` | 高压电池包电压、电流 | 否；可做运行状态观察 |
| `BrickVoltageMin/Max`、`ModuleTempMin/Max` | 单元压差和温度边界 | 否；可做异常线索，但不能自行定义 SOH |
| `BMSState` | BMS 当前运行状态 | 否；枚举状态不是容量保持率 |

字段定义见 [Tesla Fleet API：Available Data](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data) 与 [官方 protobuf](https://github.com/teslamotors/fleet-telemetry/blob/main/protos/vehicle_data.proto)（访问于 2026-09-11）。公开 Vehicle Endpoints 还列有 `service_data`，但公开文档仅称其返回车辆服务状态，没有公开响应结构或声明包含电池健康测试结果，因此不能把它当作可用的 SOH 数据源。[Tesla Fleet API：Vehicle Endpoints](https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints#service_data)（访问于 2026-09-11）

即便未来改为 Fleet Telemetry，官方说明其服务端需要公网可达并完成车辆配置，且它与 `vehicle_data` 并非完全等价；这与本项目目前“家庭 Mac mini、本地 TeslaMate/PostgreSQL”的链路不同，不能视为零成本替换。[Tesla Fleet API：Fleet Telemetry Overview](https://developer.tesla.com/docs/fleet-api/fleet-telemetry)（访问于 2026-09-11）

## 4. “续航下降”不能当作官方容量健康度

Tesla 的电池保修材料明确提醒：车辆的续航估算并不是电池容量的精确测量，因为还受容量以外的因素影响；容量测量方法和保修判断由 Tesla 决定。[Tesla New Vehicle Limited Warranty](https://digitalassets.tesla.com/tesla-contents/image/upload/tesla-new-vehicle-limited-warranty-en-my.pdf)（访问于 2026-09-11）

因此，`estimatedMaxRangeKm` 或 100% 续航趋势可以作为辅助趋势，但不能独立标成电池健康度，也不应使用“低于 70% 即保修”等自动判定。Tesla 的 70% 条款是保修门槛，不是第三方 App 仅凭续航或充电数据即可复现的测量方法。

## 5. 推荐的数据模型与展示门槛

如果后续实现“估算容量保持率”，建议至少存储并返回：

```text
estimatedUsableCapacityKwh
baselineUsableCapacityKwh
estimatedRetentionPercent
sampleCount
sampleWindowStart / sampleWindowEnd
estimatedAt
confidence: insufficient | low | medium
methodVersion
```

建议最低门槛：

- 没有用户确认的新车容量基准时，只显示 kWh 和趋势，不显示百分比。
- 至少使用多个符合 TeslaMate 官方筛选思路的完整充电样本，并采用中位数/截尾均值和离群值过滤；样本不足时显示“数据不足”。
- 区分 `battery_level` 与 `usable_battery_level`，不要混用分子分母。
- 明示“第三方估算，非 Tesla 诊断结果，不用于保修判断”。
- 若用户在车机完成 Battery Health Test，可提供独立的“Tesla 车机测试结果（用户录入）”字段，记录测试日期与来源；不要与 TeslaMate 估算混成一个值。

## 最终判断

| 方案 | 当前可行性 | 可靠性 | 推荐产品文案 |
| --- | --- | --- | --- |
| TeslaMate 当前单次充电外推 | 已实现 | 低，适合粗略参考 | 估算可用容量 |
| 复用/改进 TeslaMate Battery Health 统计方法 | 可实现 | 中，适合长期趋势 | 估算容量保持率 / 估算容量趋势 |
| Tesla Fleet API 直接读取 SOH | 当前公开接口不可用 | 不适用 | 不展示 |
| Tesla 车机 Battery Health Test | 用户可在受支持车辆运行 | 官方评估，但无法确认可自动同步 | Tesla 车机测试结果（用户录入） |

**本期建议只保留或改进“估算可用容量”，不要在概览页新增无依据的官方式“电池健康度”百分比。**
