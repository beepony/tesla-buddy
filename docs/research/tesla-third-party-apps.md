# Tesla 第三方 App 市场与 Tesla Buddy 公开发布评估

检查日期：2026-10-09（Asia/Shanghai）  
研究范围：车辆数据记录、驾驶/充电/停车历史、通知、小组件、Live Activity，以及 Tesla Fleet API、Fleet Telemetry、App Store 和中国大陆发布约束。  
说明：价格、政策和 API 条款可能变化。标为“推断”的内容来自公开资料分析，未经过 Tesla 或 Apple 确认。

## 执行结论

**建议：暂不直接做面向大众的全托管公开版；可以进入分阶段验证。** 先验证中国大陆用户是否愿意为“中文、iPhone 原生、只读、低打扰”的 Tesla 数据记录付费，再决定是否投入 Fleet Telemetry 多用户后端。

1. **海外市场已经很拥挤。** Tessie、TeslaFi、Teslascope、Stats、TezLab、Teslemetry 和 MyTeslaMate 已覆盖驾驶/充电记录、电池健康、提醒、Web、API 或 TeslaMate 托管。Tessie 已有 iPhone 小组件、Apple Watch 和充电 Live Activity。Tesla Buddy 的现有功能本身不够形成海外差异。[Tessie 定价](https://www.tessie.com/pricing)，[Tessie App Store](https://apps.apple.com/us/app/tessie/id1496718223)，[Tessie Live Activity 帮助](https://help.tessie.com/article/155-about-live-activities)
2. **中国大陆仍有窗口，但证据有限。** 中文市场已出现 TeslaMate 云托管和 TeslaMate 客户端，例如麦特云、特斯喵、MateDrive。这说明有需求，也说明“TeslaMate 的漂亮 iOS 外壳”很快会被复制。[麦特云](https://www.myteslacloud.com/)，[特斯喵 App Store](https://apps.apple.com/cn/app/%E7%89%B9%E6%96%AF%E5%96%B5/id6759157666)，[MateDrive App Store](https://apps.apple.com/cn/app/matedrive-teslamate-client/id6759969639)
3. **按次计费的 API 成本可控，运营责任才是主要难点。** Tesla 官方示例中，一小时驾驶的 Fleet Telemetry 成本约 0.00636 美元；改用轮询 `vehicle_data` 的成本会高得多。真正的门槛是公网遥测服务、虚拟钥匙配对、令牌安全、位置隐私、中国区独立应用、支付/计费状态和客服。[Tesla Fleet Telemetry](https://developer.tesla.com/docs/fleet-api/fleet-telemetry)，[Tesla Billing and Limits](https://developer.tesla.com/docs/fleet-api/billing-and-limits)
4. **当前架构不宜作为公开产品基础。** TeslaMate 官方 FAQ 明确说明 PostgreSQL 和网页路由都不是公共接口，唯一支持的集成面是 MQTT。Tesla Buddy 当前直接读 TeslaMate 数据库，适合私用；公开发布后升级兼容风险会转嫁给用户和你。[TeslaMate FAQ](https://docs.teslamate.org/docs/faq/)

## 市场对比

| 产品 | 定位与平台 | 数据方式 | 主要能力 | 当前公开价格 | 隐私/删除与中国支持 |
|---|---|---|---|---|---|
| [TeslaMate](https://github.com/teslamate-org/teslamate) | 开源自托管记录器；Web/Grafana | 默认 Owner API 与旧流；可接 Fleet API/Telemetry | 驾驶、充电、电池、地理围栏、Grafana、MQTT | 软件免费；用户承担服务器 | 数据在用户自己的服务器；官方文档列出中国 Fleet API 端点。[TeslaMate API 文档](https://github.com/teslamate-org/teslamate/blob/main/website/docs/configuration/api.md) |
| [TeslaFi](https://www.teslafi.com/signup.php) | 老牌云端记录器；Web | 官方 Fleet API | 记录、导出、API；Rivian 也支持 | 14 天试用；7.99 美元/月或 79.99 美元/年 | 可在设置中自助删除账户和数据。[TeslaFi 安全页](https://www.teslafi.com/security.php)；中国支持未说明 |
| [Teslascope](https://teslascope.com/membership) | Web + iOS 社区与数据平台 | Tesla OAuth、Fleet API、Fleet Telemetry | 软件更新、FSD 统计、驾驶/充电、费用、日历、提醒、自动化、Sentry 通知 | 免费；Plus 3.99 美元/月；Pro 6.99 美元/月（按车） | 停用后 30 天内删除，部分法定记录除外。[Teslascope 隐私政策](https://teslascope.com/legalese/privacy)；中国支持未说明 |
| [Tessie](https://www.tessie.com/pricing) | 功能最全的消费级平台；Web、iOS、Watch、Android、Wear OS | Fleet API 与 Fleet Telemetry | 记录、电池、提醒、自动化、Sentry、软件更新、OBD Profiler、API、Live Activity | 6.99/12.99/19.99 美元/月（按车）；年付和终身方案 | 应用内删除账户及全部历史。[Tessie 删除账户](https://help.tessie.com/article/111-delete-account)；中国支持未说明 |
| [Stats](https://apps.apple.com/us/app/stats-for-your-tesla/id1191100729) | iPhone/iPad/Watch 原生应用 | 官方 Tesla API；已注册第三方应用 | 电池、充电、驾驶、待机耗电、提醒、小组件、Siri、行车记录仪查看、导出 | 9.99 美元/月；100 美元/年；终身 249.99 美元；另有单项购买 | App Store 标签为“未关联用户”的用户内容和 ID；需 iCloud Drive；中国支持未说明 |
| [Teslemetry](https://teslemetry.com/pricing) | 开发者与智能家居 API 中间层 | Fleet API、Fleet Telemetry、SSE/Webhook | Home Assistant、Homey、MCP、Node-RED、命令积分 | 页面显示车辆访问 A$45 起；周期选择未在抓取内容中确定 | 可在网页删除账户与数据。[Teslemetry 隐私政策](https://teslemetry.com/docs/about/privacy)；隐私政策列出北美/欧洲区域，未列中国 |
| [MyTeslaMate](https://www.myteslamate.com/) | TeslaMate 云托管；Web/Grafana | Owner/Fleet API 可切换；Fleet API 代理 | 托管 TeslaMate、导入、备份、MQTT、Home Assistant、Sentry 告警 | 4.99 欧元/月/车；年付折合 3.75 欧元/月/车；API 按量 | 数据在欧洲；可随时下载备份；中国支持未说明 |
| [TezLab](https://apps.apple.com/us/app/tezlab-for-tesla-rivian/id1239581716) | iPhone 社区型 EV 应用 | 虚拟钥匙确认后下发 Fleet Telemetry 配置。[TezLab 数据采集说明](https://support.tezlabapp.com/article/36-how-is-data-captured) | 车辆报告、电池、行程、充电、待机耗电、通知、自动化、控制 | Pro 6.99 美元/月或 59.99 美元/年 | App Store 标签含联系信息、ID、支付和诊断；中国支持未说明 |
| [麦特云 MyTeslaCloud](https://www.myteslacloud.com/) | 中文 TeslaMate 云托管 | 页面称使用 Tesla 官方 OAuth；具体 API 类型未说明 | TeslaMate 数据、Scriptable 小组件、第三方 iOS App 对接 | 159.9 元/年/车；439.9 元终身/车 | 支持支付宝/微信；页面称每人独立数据库；联系管理员导出；删除流程未见 |
| 特斯喵 / MateDrive | 中国区 iOS TeslaMate 客户端 | 连接用户自建 TeslaMate；MateDrive 称不直接连接 Tesla | 实时状态、行程地图、充电、胎压、电池等 | 特斯喵 15 元/月；MateDrive 价格未核实 | 均依赖用户自建服务。[特斯喵](https://apps.apple.com/cn/app/%E7%89%B9%E6%96%AF%E5%96%B5/id6759157666)，[MateDrive](https://apps.apple.com/cn/app/matedrive-teslamate-client/id6759969639) |
| [Watchla](https://apps.apple.com/us/app/watchla-for-tesla/id1546599747) | Apple Watch 控制与钥匙 | 蓝牙和 Tesla 连接 | 手表钥匙、离线控制、复杂功能、命令 | 未核实 | 控制类产品，和 Tesla Buddy 的只读定位重叠较少 |

Nikola 未找到当前可用的官方网站或有效 App Store 页面，因此未纳入主要竞品。专门的 Sentry/行车记录仪查看器也未纳入，只有 Stats 和 Teslascope 中相关功能被记录。

## Tesla 平台约束

### 注册、授权和区域

- 第三方应用需申请 Tesla 开发者应用，获得 Client ID 和 Client Secret 后，通过 OAuth 获取用户令牌。[Tesla Developer](https://developer.tesla.com/)
- 只读产品通常需要 `openid`、`offline_access`、`vehicle_device_data`；地图、停车和行程需要 `vehicle_location`；充电历史和账单相关数据可能涉及 `vehicle_charging_cmds`，但该 scope 也包含开始/停止充电等命令。Tesla 要求只申请当前必要的 scope。[Tesla OAuth Scopes](https://developer.tesla.com/docs/fleet-api/authentication/overview)，[Tesla 公告](https://developer.tesla.com/docs/fleet-api/announcements)
- **中国大陆要单独建应用。** Tesla 说明，中国车辆需在 tesla.cn 建账户，并在 developer.tesla.cn 创建单独应用，需要 +86 手机号；API 地址为 `fleet-api.prd.cn.vn.cloud.tesla.cn`。[Tesla Regions](https://developer.tesla.com/docs/fleet-api/getting-started/regions-countries)
- Tesla 的支付国家列表未包含中国大陆。Tesla 2024-11-27 公告说，在不支持付款的国家创建的应用从 2025 年 1 月起会受到使用限制。中国区“订阅计划”页面本次多次超时，未能核实完整额度，因此中国大陆规模化上线前必须向 Tesla 中国开发者支持确认。[Tesla 公告](https://developer.tesla.com/docs/fleet-api/announcements)，[Tesla 中国区订阅计划](https://developer.tesla.cn/docs/fleet-api/getting-started/subscription-plans)

### Fleet Telemetry 与 vehicle_data

Fleet Telemetry 要求公网服务器、车辆固件满足要求、用户配对虚拟钥匙，并通过 vehicle-command proxy 签名配置。单车最多可同时向 5 个第三方应用推送数据。位置字段需要 `vehicle_location`；如果车辆共享隐藏了私人信息，位置字段会被拒绝。[Fleet Telemetry](https://developer.tesla.com/docs/fleet-api/fleet-telemetry)

Fleet Telemetry 只在字段变化且达到间隔后发送，车辆离线时最多缓存 5000 条消息。它不完全等同于 `vehicle_data`，因此 OTA、停车、胎压和充电成本等功能要逐项核对字段。[Fleet Telemetry](https://developer.tesla.com/docs/fleet-api/fleet-telemetry)，[可用字段](https://developer.tesla.com/docs/fleet-api/fleet-telemetry/available-data)

### 计费和成本

Tesla 当前美元价格为：流式信号 150,000 个/1 美元，命令 1,000 次/1 美元，数据请求 500 次/1 美元，唤醒 50 次/1 美元。每个账户每月有 10 美元折扣。超过账单上限后 API 会暂停，已配置的 Telemetry 会被删除且不会自动恢复。[Tesla 定价](https://developer.tesla.com/)，[Billing and Limits](https://developer.tesla.com/docs/fleet-api/billing-and-limits)

**推断：** 只读 Telemetry 的 Tesla API 费用可以压到每车每月几美分到几十美分；如果打开 App 时轮询 `vehicle_data` 或唤醒车辆，成本会明显上升，还可能影响车辆休眠。服务器、地图、推送、数据库备份、监控、支付和客服很可能高于 Tesla API 费用。

### TeslaMate 的官方立场

TeslaMate 文档认为，个人用户使用 Fleet API 和 Telemetry 目前主要带来限制，仅建议商业车队用户迁移；同时提供 MyTeslaMate、Teslemetry 或自建 Telemetry 的配置方式。[TeslaMate 官方 API 文档](https://github.com/teslamate-org/teslamate/blob/main/website/docs/configuration/api.md)

这对 Tesla Buddy 很关键：继续依赖 TeslaMate 时，产品适合“自托管增强客户端”；改成公开云产品时，应自建 Fleet Telemetry 数据管线，并停止把 TeslaMate 数据库当作稳定接口。

## Apple 与中国大陆上架要求

- **账户删除：** 支持账户创建的 App 必须提供应用内发起删除账户的入口。[Apple 账户删除要求](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- **审核账号：** 需要登录的功能必须提供可用演示账号或完整演示模式，审核期间后端必须在线。[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **隐私标签：** 需要申报离开设备并保存的数据，包括第三方 SDK 收集的数据；精确位置有明确定义。[Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- **商标：** Apple 禁止未经许可使用第三方商标或制造误导性关联。Tesla 也声明其网站标识受商标权保护。[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)，[Tesla 知识产权声明](https://www.tesla.com/legal/additional-resources)
- **中国 ICP：** App Store Connect 要求部分 App 填写有效 ICP 备案号，且 App 信息要和工信部备案一致。**推断：** 如果服务端在中国大陆部署或面向中国大陆提供联网服务，应按 ICP 备案准备；具体主体和服务类型需咨询备案服务商或律师。[App Store Connect App 信息](https://developer.apple.com/cn/help/app-store-connect/reference/app-information/app-information/)
- **数据保护：** Tesla 中国 Fleet API 条款要求开发者遵守《个人信息保护法》《网络安全法》《数据安全法》等，并要求事先通知和取得同意。[Tesla 中国条款](https://www.tesla.cn/legal/terms)

## 战略评估

### 差异化机会

1. **中国大陆、中文和本地场景：** 国网/特来电/家充分时电价、超充费用核对、发票、停车耗电、月度报告和中文客服。海外主流产品多数没有明确中国大陆支持。
2. **只读和隐私优先：** 不申请命令权限，不唤醒车辆，不做营销追踪，支持一键撤权和删除。这个定位比“功能更多”更容易被信任。
3. **iPhone 原生体验：** 灵动岛、锁屏 Live Activity、小组件、通知摘要和 Apple Watch 都是 Tessie 已覆盖的方向，但中文市场的原生体验仍可能有空间。
4. **双模式：** 先支持自托管 TeslaMate（通过稳定的 API/MQTT 适配层），再提供官方 Fleet Telemetry 托管版。自托管版可低成本验证留存，托管版再负责扩大用户。

### 主要风险

| 风险 | 影响 | 应对 |
|---|---|---|
| Tesla 政策变化 | 价格、scope、额度或审核可能改变；严重时应用被停用 | 只读、少 scope、预算上限、多区域开关、保留导出 |
| 中国区 API 额度不明 | 中国大陆可能无法规模化或无法付费扩容 | 上线前取得 Tesla 中国书面答复 |
| 名称和图标 | “Tesla Buddy”包含 Tesla 商标，可能被 Apple 或 Tesla 投诉 | 改为独立品牌，只在描述中说明兼容 Tesla，不用 Tesla Logo |
| 位置和令牌泄露 | 会暴露住址、通勤和车辆信息 | 令牌加密、密钥轮换、最小日志、访问审计、删除流程 |
| TeslaMate 数据库变化 | 自托管用户升级后功能失效 | 不直接读库；使用 MQTT 或自有稳定 API |
| 同质化 | 用户可能直接选择 Tessie、麦特云或免费 TeslaMate | 先找愿意付费的细分人群，再扩大 |

## 分阶段验证

1. **0-4 周：用户验证。** 改名，并做中文落地页和 TestFlight 候补名单。目标为 200 个有效报名，其中至少 50 人愿意参与测试，至少 20 人愿意预付或填写明确价格。
2. **4-8 周：自托管 Beta。** 只连接用户自己的 TeslaMate，通过稳定接口读取。验证 7 日/30 日留存、最常用页面、Live Activity 和报告的付费意愿。
3. **8-12 周：中国区 Fleet 可行性。** 用 developer.tesla.cn 创建测试应用，完成 OAuth、虚拟钥匙、Telemetry、撤权和删除。拿到额度和计费书面答复后再招托管用户。
4. **12 周后：小规模托管 Beta。** 限 20-50 辆车，记录每车 Tesla API、服务器、地图、推送和客服成本。只有毛利、稳定性和隐私流程都过关，才公开上架。

## 决策清单

- [ ] 已更换不含 Tesla 商标的应用名、图标和开发者名称。
- [ ] 已明确目标市场：中国大陆、海外，或两者分开发布。
- [ ] 已确认中国区 Fleet API 应用、+86 账户、可用额度和扩容方式。
- [ ] 已列出每个功能需要的 Telemetry 字段，并确认没有依赖频繁 `vehicle_data` 轮询。
- [ ] 已确定最小 scope；不申请普通车辆命令权限。
- [ ] 已实现令牌加密、撤权检测、账户删除、数据导出和服务端日志脱敏。
- [ ] 已准备审核演示账号、演示车辆数据和完整的隐私标签。
- [ ] 已确认 ICP、隐私政策、用户协议、个人信息出境或跨境处理要求。
- [ ] 已设置 Tesla 账单上限和告警，并测试达到上限后的恢复流程。
- [ ] 至少 20 名用户愿意按目标价格付费，且 30 日留存达到预设目标。

## 局限

本报告优先使用官方站点、价格页、App Store 页面、隐私政策和项目文档。中国区 Tesla 订阅计划页面无法完整读取；部分 App Store 价格因国家/地区而异；Nikola 和部分中国产品缺少可核实的官方资料。没有访问任何付费后台，也没有测试竞品实际数据准确性。
