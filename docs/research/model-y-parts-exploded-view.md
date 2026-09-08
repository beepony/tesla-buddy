# Model Y 全车零部件目录与交互式拆解视图可行性调研

- 调研日期：2026-09-08
- 适用项目：Tesla Buddy（iOS 17+ 原生 App + 家庭 Mac mini 本地 API）
- 结论性质：产品与技术可行性建议；知识产权部分不是法律意见，发布前应由熟悉目标市场的律师复核

## 结论先行

**可以实现，但应把目标改成“面向特定车辆配置、逐步扩展的交互式部件探索器”，不能在没有 Tesla 或合格数据供应商书面授权的前提下承诺“完整收录所有 Model Y 型号、所有零件和官方爆炸图”。**

原因分成两层：

1. **交互技术可行。** 现有 App 是 iOS 17+、SwiftUI/Swift 6；Apple RealityKit 能加载保留节点层级的 USD/USDZ/Reality 文件，实体可配置点击命中，适合实现旋转、缩放、逐层分离、点击高亮和部件详情。保持 iOS 17 最低版本时应把 RealityKit `ARView` 包装进 SwiftUI；SwiftUI 原生 `RealityView` 需要 iOS 18+。Apple 也明确提醒复杂网格、纹理和大量实体会增加 CPU/GPU 与加载成本，因此必须按系统拆包、异步加载和分级精度。[Apple：加载实体文件](https://developer.apple.com/documentation/realitykit/loading-entities-from-a-file)、[Apple：Entity](https://developer.apple.com/documentation/realitykit/entity)、[Apple：InputTargetComponent](https://developer.apple.com/documentation/realitykit/inputtargetcomponent)、[Apple：RealityKit 性能](https://developer.apple.com/documentation/realitykit/improving-the-performance-of-a-realitykit-app)（访问于 2026-09-08）
2. **官方内容不能直接搬进 App。** Tesla 虽称 Service 网站可免费访问维修资料、服务手册、零件目录和线路图，但 EPC 条款把目录内容限定为购买/维修相关用途，并明确禁止复制、保存、下载、修改或发布。Tesla 的一般知识产权声明也说其网站的文字、图片、图形、动画等受保护，商业使用、分发、修改或重新发布需要许可。免费查看不等于获得再利用授权。[Tesla Service 首页](https://service.tesla.com/)、[Tesla EPC 条款](https://service.tesla.com/docs/Public/epc/TermsAndConditions/NON_TABS_en-US.html)、[Tesla 知识产权声明](https://www.tesla.com/en_ph/legal/additional-resources#intellectual-property)（访问于 2026-09-08）

因此，推荐路线是：**自有/获授权的元数据与 2D/3D 资产 + 按具体车辆配置匹配 + 官方页面仅作人工核验或链接跳转**。不要抓取、缓存、截图切图、重绘式复制 Tesla EPC 或服务手册中的图像与目录结构。

## 1. “完全展示”为什么不是一个可稳定验收的范围

“Model Y”不是一份永久不变的物料清单。官方资料已经展示了至少以下维度：

- VIN 包含车身方向、动力/驱动类型、年份和制造工厂；官方 2020–2024 手册列出 Fremont/Austin、Shanghai、Berlin 等 WMI/工厂，以及单电机、双电机、Performance 和不同电池类型。[Tesla：Model Y VIN 解码](https://service.tesla.com/docs/ModelY/ServiceManual/en-au/air/GUID-0C797294-574D-4EE4-8017-C339A7D58411.html)（访问于 2026-09-08）
- Tesla 的 2025+ VIN 页面使用独立年份手册，说明旧款与改款不能视为同一配置集合。[Tesla：2025+ Model Y VIN](https://service.tesla.com/docs/ModelY/ServiceManual/2025/fr-ca/GUID-BB4CE449-3F8E-4905-AF4A-96DFA87535B5.html)（访问于 2026-09-08；该链接存在地区重定向，内容可用性可能随地区变化）
- 官方手册称 Tesla 持续修改车辆规格、设计和生产，手册不应被视为任何具体车辆当前规格的绝对无误指南；同一手册还说明 LHD/RHD 程序可能相同、略有不同或需要独立程序。[Tesla：如何使用 Model Y 服务手册](https://service.tesla.com/docs/ModelY/ServiceManual/en-us/GUID-3DA181F8-CE31-413A-B208-838240CAD3F4.html)（访问于 2026-09-08）
- Tesla 的碰撞中心运营标准要求在 EPC 中准确输入 VIN，以驱动配置选项和 supersession（替代/升级件）逻辑。这说明年份、款型和工厂仍不足以可靠决定某个具体零件是否适用。[Tesla Approved Collision Center Operating Standards，第 7 节](https://service.tesla.com/docs/Public/TeslaApprovedCollisionCenters/Tesla_Body_Repair_Program_Operating_Standards.pdf)（访问于 2026-09-08）
- 服务手册的易耗件页面也明确说零件号只在发布时有效，应以 EPC 中的当前修订号为准。[Tesla：Model Y Consumable Parts](https://service.tesla.com/docs/ModelY/ServiceManual/en-us/GUID-375EED5D-EB52-47F1-94B4-B7C1CCC64178.html)（访问于 2026-09-08）

此外，“所有零部件”本身需要先定义粒度：只到可采购总成，还是继续拆到紧固件、线束端子、胶粘剂、标签、密封件和不可单独销售的内部件？EPC、服务程序、工程 BOM 与实车制造 BOM 不是同一份东西。对消费者产品，合理且可验收的定义应是：

> 在声明支持的车辆范围内，展示本产品已验证的“可识别/可采购总成与常见服务件”；每条记录显示适用范围、数据版本、来源类型、验证状态和“不是官方维修判定”的提示。

不建议使用“全车 100%”“所有型号”“精确适配所有 VIN”等营销措辞，除非已获得持续更新的权威 fitment 数据和合同责任边界。

## 2. 官方资料能提供什么，不能提供什么

### 2.1 Tesla Service Manual

Tesla Service 首页将 DIY 指南、服务手册、零件目录、线路图等描述为免费维修和维护信息；服务手册以车辆子系统组织，包含拆装步骤、工具、扭矩和装配信息。[Tesla Service 首页](https://service.tesla.com/)、[Tesla：如何使用手册](https://service.tesla.com/docs/ModelY/ServiceManual/en-us/GUID-3DA181F8-CE31-413A-B208-838240CAD3F4.html)（访问于 2026-09-08）

适合的用法：产品经理或内容编辑人工确认术语、系统层级、风险提示和官方跳转链接。

不适合的用法：批量复制步骤、图片或完整表格进入 App；把服务手册当作稳定 API；将它当作特定 VIN 的完整 BOM。Tesla 手册本身也警告只有合格技师应执行相关流程，并说明资料可能不完全符合某台车的当前规格。[Tesla：如何使用手册](https://service.tesla.com/docs/ModelY/ServiceManual/en-us/GUID-3DA181F8-CE31-413A-B208-838240CAD3F4.html)（访问于 2026-09-08）

### 2.2 Tesla EPC / Parts Catalog

`https://epc.tesla.com/` 在本次调研时重定向至 `https://parts.tesla.com/`。Tesla 官方的 parts-and-tools 页面说明，用户可以浏览所在国家的已发布目录，查看零件号、图示、描述和价格，并从 VIN、车型或零件号/关键词开始搜索；下单需要 Tesla Account。服务手册也把详细零件号查询指向 EPC。[Tesla Parts Catalog](https://parts.tesla.com/)、[Tesla：Purchasing Parts and Tools](https://service.tesla.com/en-US/parts-and-tools)、[Tesla：Consumable Parts](https://service.tesla.com/docs/ModelY/ServiceManual/en-us/GUID-375EED5D-EB52-47F1-94B4-B7C1CCC64178.html)（访问于 2026-09-08）

关键限制：

- EPC 条款允许 Tesla 随时更改、删除内容或终止访问；官方采购页要求登录账户才能下单。本次未找到公开、稳定、获准再发布的零件目录 API。[Tesla EPC 条款，第 1、8 节](https://service.tesla.com/docs/Public/epc/TermsAndConditions/NON_TABS_en-US.html)、[Tesla：Purchasing Parts and Tools](https://service.tesla.com/en-US/parts-and-tools)（访问于 2026-09-08）
- 条款限定内容用于购买零件的决定及所在地区的维修/服务，并禁止复制、保存、下载、修改、删除标记以及披露/发布 EPC 内容。[Tesla EPC 条款，第 8、16 节](https://service.tesla.com/docs/Public/epc/TermsAndConditions/NON_TABS_en-US.html)（访问于 2026-09-08）
- 条款说明不同国家/地区可能提供不同内容或零件。因此即便技术上能登录，也不能假设一个地区的目录覆盖全球 Model Y。[Tesla EPC 条款，第 8 节](https://service.tesla.com/docs/Public/epc/TermsAndConditions/NON_TABS_en-US.html)（访问于 2026-09-08）

结论：**不能把 EPC 抓取器或 EPC 镜像作为本功能的数据后端。** 如果希望使用 EPC 的图、目录文本、fitment 或持续同步数据，应先与 Tesla 获得明确书面许可，许可中至少应覆盖复制、派生、App 内展示、缓存、地区、更新频率和终止后的数据处理。

## 3. 数据与 3D 资产方案比较

| 方案 | 完整度/准确性潜力 | 上线速度 | 授权风险 | 持续成本 | 建议 |
| --- | --- | --- | --- | --- | --- |
| 抓取/镜像 Tesla EPC 与手册 | 理论上高，但会随地区和修订变化 | 初期快 | **不可接受**：EPC 条款明确禁止复制、保存、下载、修改和发布 | 高，页面变化即失效 | 不采用 |
| 与 Tesla 签订内容许可/数据合作 | 最高，可争取 VIN 适配 | 最慢且不确定 | 获得合适许可后低 | 商务、合规与同步成本高 | 长期首选，但不能作为 MVP 的唯一前提 |
| 购买第三方 fitment/零件数据与 3D 资产许可 | 取决于供应商覆盖与权利链 | 中等 | 中；必须审查来源、再分发和衍生权 | 许可费 + QA | 可并行询价/验证，合同必须保证权利与更新 SLA |
| 自建原创 2D 图 + 人工维护元数据 | 适合系统/总成级，不适合声称完整 | 快 | 较低；仍需避免实质复制官方图片/目录编排 | 中 | **推荐 MVP** |
| 自建原创低多边形 3D + 人工维护元数据 | 交互体验好；机械精度由建模投入决定 | 中慢 | 较低；需确认测绘/参考材料权利 | 高，资产制作是主要成本 | 推荐第二阶段 |
| 只链接 Tesla 官方页面，不缓存内容 | 内容由 Tesla 维护 | 快 | 相对较低，但仍需遵守链接、品牌与地区规则 | 低 | 适合作为“查看官方资料”，不等同于 App 内完整目录 |
| 用户拍照/扫描自己的车辆或零件 | 个车相关性高，但遮挡导致不完整 | 慢且不稳定 | 中；需处理隐私和上传内容权利 | 高 | 只适合后续辅助识别，不适合作为目录主源 |

### 推荐的权利边界

- 零件号、短名称和适配断言应来自**明确可再分发的授权数据**，或由团队基于合法来源逐条独立编写与验证；不要复制官方描述、说明文字或分类编排。
- 2D/3D 外观由团队原创、委托制作且合同转让/许可足够的权利，或购买包含移动端分发、修改、LOD 和派生动画权的资产。
- 不使用 Tesla 的 EPC 爆炸图、手册图片、网页截图、Logo、车型铭牌图形或官网 3D 模型作为产品资产。Tesla 的一般声明明确把网站文字、图片、图形、动画和编排纳入保护，并称网站不授予默示知识产权许可。[Tesla 知识产权声明](https://www.tesla.com/en_ph/legal/additional-resources#intellectual-property)（访问于 2026-09-08）
- “Tesla”和“Model Y”只作必要的兼容性描述；产品名称、图标与首屏避免造成官方、赞助或认证关系的暗示，并加醒目的独立第三方声明。Tesla 将车型铭牌、Logo 和标识列为其商标。[Tesla 知识产权声明](https://www.tesla.com/en_ph/legal/additional-resources#intellectual-property)、[Tesla Model Y Owner's Manual：Copyrights and Trademarks](https://www.tesla.com/ownersmanual/modely/en_us/GUID-59E1B254-DB74-4178-B727-CE12EA84A2F7.html)（访问于 2026-09-08）
- Tesla 的 patent pledge 不是对版权、商标、车型外观、EPC 数据或网站内容的通用许可；Tesla 自己说明该 pledge 不是一项全面授权，且“仿制品/暗示关联”会影响 good-faith 条件。[Tesla Patent Pledge](https://www.tesla.com/legal/additional-resources#patent-pledge)（访问于 2026-09-08）

## 4. 对现有项目的架构建议

### 4.1 当前缺口

仓库的 PostgreSQL 适配器目前查询 `cars` 的 `model` 和 `marketing_name` 并输出展示名称，但 API 模型没有 VIN、工厂、车型年份、左右舵、驱动/电池配置或生产变更点字段（见 [`apps/api/src/postgres-repository.mjs`](../../apps/api/src/postgres-repository.mjs)，尤其第 14–34、43–68 行）。因此现有数据只够显示“Model Y/营销名称”，不够做零件适配承诺。

项目技术栈已经适合增量实现：iOS target 是 Swift 6、iOS 17+、SwiftUI（[`apps/ios/project.yml`](../../apps/ios/project.yml)）；本地服务是 Node.js 22、PostgreSQL 驱动（[`package.json`](../../package.json)）。不需要换技术栈。

### 4.2 建议模块边界

```text
用户选车/本车资料
  └─ VehicleConfiguration（年份、工厂、驱动、座椅、方向、地区、变更点；字段可未知）
          ↓ 规则匹配，永不把“未知”猜成“适用”
Versioned Parts Catalog（原创/获授权）
  ├─ System → Assembly → Part 层级
  ├─ PartRevision / supersession（替代与修订）
  ├─ ApplicabilityRule（适用配置、时间段、验证状态）
  ├─ SourceRecord（来源类型、许可、核验日期、证据指纹）
  └─ AssetManifest（2D/3D 包、节点 ID、LOD、哈希、大小）
          ↓
本地 API：目录查询、资产清单、版本更新
          ↓
iOS：SwiftUI 列表/搜索 + RealityKit 交互视图 + 本地缓存
```

核心数据对象建议：

- `VehicleConfiguration`：不要只靠 VIN 自动解码。VIN 能给出年份、工厂和动力等大类，但官方公告表明具体适用性可能依赖更细的 VIN 列表/车辆档案。允许用户确认配置并显示“不确定”。
- `Part` 与 `PartRevision` 分离：零件号修订、替代关系和生效区间必须可追溯。
- `ApplicabilityRule` 使用三值结果：`confirmed / excluded / unknown`，而不是布尔值。未知时显示“需在 Tesla 官方零件目录或服务中心核对”。
- `SourceRecord` 记录 `source_kind`、许可证明、核验者、核验时间和证据摘要；若某来源不允许复制，只存人工结论与链接，不存页面副本。
- `AssetManifest` 将部件稳定 ID 映射到原创 2D hotspot 或 3D entity 名称；目录元数据与大体积资产分离发布。

### 4.3 iOS 3D 实现

- 保持当前 iOS 17 最低版本时，用 `UIViewRepresentable` 把 RealityKit `ARView` 接入 SwiftUI，并用实体层级承载车辆、系统、总成和部件；若未来把最低版本升到 iOS 18，可改用 SwiftUI 原生 `RealityView`。Apple 文档说明 USD/Reality 文件可保留 entity hierarchy；每个可点击节点使用稳定的内部 `partId`，不要用显示名称作主键。[Apple：加载实体文件](https://developer.apple.com/documentation/realitykit/loading-entities-from-a-file)、[Apple：Entity](https://developer.apple.com/documentation/realitykit/entity)（访问于 2026-09-08）
- 点击：在 iOS 17 的 `ARView` 中为实体生成碰撞形状并用 hit testing/raycast 取得命中的实体；升级到 iOS 18 的 `RealityView` 后，可为可交互实体配置 `InputTargetComponent` 和 `CollisionComponent`，并用 SwiftUI targeted entity gesture 处理点击。[Apple：InputTargetComponent](https://developer.apple.com/documentation/realitykit/inputtargetcomponent)、[Apple：targetedToAnyEntity](https://developer.apple.com/documentation/SwiftUI/Gesture/targetedToAnyEntity%28%29)（访问于 2026-09-08）
- “拆解”应是预定义层级/轨迹动画：保存每个节点的装配 transform 与 exploded transform，按系统或步骤插值；不要启用真实物理模拟来替代工程装配顺序。
- 资产按“车身/内饰/底盘/悬架/制动/热管理/高压/低压”等包拆分，异步加载，按设备动态选择 LOD。Apple 建议共享网格资源、避免在交互期间创建/加载重资产，并把大型资产拆成更小集合。[Apple：降低 RealityKit CPU 使用](https://developer.apple.com/documentation/realitykit/reducing-cpu-utilization-in-your-realitykit-app)、[Apple：降低 RealityKit GPU 使用](https://developer.apple.com/documentation/realitykit/reducing-gpu-utilization-in-your-realitykit-app)（访问于 2026-09-08）
- 资产可由本地 API 按 manifest 提供并缓存到可清除目录；首包只含 2D 缩略图和一套轻量演示总成。不要把全车高精模型直接塞入 IPA。Apple 也建议测量 App 大小、移除未用资产并用资产目录/按需策略控制体积。[Apple：减小 App 大小](https://developer.apple.com/documentation/xcode/doing-basic-optimization-to-reduce-your-app-s-size)（访问于 2026-09-08）

### 4.4 安全与产品表述

- 这是“部件识别与知识浏览”，不是维修指导、诊断结论或安全适配保证。
- 高压电池、气囊、制动、悬架等页面应显示醒目安全提示，并把维修操作导向合格技师/官方文档。Tesla 手册也明确维修程序面向合格技师。[Tesla：如何使用手册](https://service.tesla.com/docs/ModelY/ServiceManual/en-us/GUID-3DA181F8-CE31-413A-B208-838240CAD3F4.html)（访问于 2026-09-08）
- 不在分析日志、崩溃日志或公开 API 中记录完整 VIN。按现有“本地优先”原则，把车辆配置放在本地服务；客户端只取得匹配所需的非敏感 profile 或不可逆配置 ID。

## 5. 推荐 MVP 分期与验收

### Phase 0：权利与内容样本验证（1–2 周）

目标：在写 3D 功能前证明“内容能合法获得并持续维护”。

- 选定一台具体 Model Y，记录年份、工厂、驱动、地区、左右舵及已知选装；不公开完整 VIN。
- 选一个低安全风险系统，例如轮毂/轮胎或前备箱饰板，做 20–50 个部件的样本目录。
- 每个字段标注来源类型、许可、核验日期和 `confirmed/unknown` 状态。
- 取得原创/委托 2D 或低多边形 3D 资产的权利文件。

**Go/No-Go：** 若无法证明数据和资产可在 App 中再分发，则停止做“内置完整目录”，改为原创概览 + 官方资料跳转。

### Phase 1：2D 可点击系统图 MVP（3–5 周）

- 新增“车辆结构”入口、系统列表、搜索和部件详情。
- 使用原创 2D 分层插画和 hotspots；支持展开到 assembly，不追求每颗紧固件。
- 仅支持一台已确认车辆配置，页面明确显示目录版本、覆盖率和未知项。
- 加入静态版本化 manifest、本地缓存、缺失/回滚机制和内容单元测试。

**验收：** 所有显示部件能追溯到合法来源；错误配置不会返回“确认适用”；无网络时已下载系统可浏览；零 Tesla 官方图被打包进 App。

### Phase 2：一个系统的 3D 拆解试点（4–7 周）

- 把 Phase 1 中一个总成换成原创 USDZ/Reality 分层资产。
- 完成旋转、缩放、分层拆解、点击高亮、详情联动与恢复装配。
- 在最低支持设备和至少一台中档真机测量首帧、峰值内存、交互帧率、下载与磁盘占用。

**验收建议：** 交互期间无主线程同步加载；节点 ID 与目录 ID 全量对应；丢失节点/重复 ID 在构建或内容发布前失败；较旧设备可降级到 2D。

### Phase 3：扩大覆盖与车辆匹配（8–16+ 周，持续内容工程）

- 扩大到 8–12 个主要系统，逐步增加服务级零件和修订/替代关系。
- 建立配置确认界面、适配规则测试矩阵、内容审核后台或受控内容流水线。
- 对接获授权供应商或 Tesla 许可；否则始终保留“已验证子集”定位。

### Phase 4：高覆盖产品（6–12+ 人月起，且长期维护）

这是“特定年份/地区/工厂/配置的高覆盖服务件目录”，不是一次性交付。若要求跨全球地区、跨所有生产年份、精确到每个 VIN 和每个可采购/不可采购件，范围是开放式的，只有持续权威 feed、内容团队和合同 SLA 才可能接近完成。

## 6. 粗略工作量与主要风险

以下为基于当前仓库和上述范围的工程估算，不是供应商报价；假设 1 名 iOS 工程师、1 名后端/数据工程师按需投入，另有 3D/技术美术与内容 QA：

| 交付 | 工程/内容估算 | 最大不确定性 |
| --- | --- | --- |
| Phase 0 样本与权利核验 | 1–2 周 | Tesla/第三方许可是否可得；原始数据是否允许再分发 |
| 原创 2D 单配置 MVP | 3–5 周 | 内容整理与热点 QA，而非代码 |
| 单总成 3D 拆解试点 | 4–7 周 | 原始 CAD/网格质量、节点拆分、移动端优化 |
| 8–12 系统可用版 | 8–16+ 周 | 每系统资产复杂度、适配规则与真机性能 |
| 单地区/有限年份高覆盖目录 | 6–12+ 人月 | 获授权数据、持续变更、人工核验吞吐 |
| 全球所有年份/所有配置/所有部件 | 无法给出封闭工期 | 没有完整权威 feed 与许可时不可承诺 |

风险优先级：

1. **P0—内容许可/IP：** 未获许可复制 EPC/手册即可使方案不能发布。
2. **P0—错误适配与安全：** 错误零件号或把近似款当成适用件可能导致维修/安全风险。
3. **P1—内容维护：** Tesla 会持续更新规格和部件修订；一次性录入很快过期。
4. **P1—3D 资产成本：** 点击拆解需要每个零件独立节点、命名、pivot、遮挡处理和动画，不是拿到一个车壳模型即可。
5. **P1—移动端性能/体积：** 高精网格和纹理会拉高内存、GPU、下载和磁盘占用。
6. **P2—产品误解：** 用户容易把教育性视图当作官方维修/适配结论，需要明确状态和警示。

## 7. 推荐决策

建议批准一个严格受限的探索版本：

- 产品名称使用“Model Y 车辆结构”或“部件探索”，不用“官方全车 EPC”。
- 第一个版本只覆盖**用户这台车的一个已确认配置 + 1 个系统 + 20–50 个部件**。
- 先原创 2D，验证信息架构、搜索、点击和详情是否有用；随后只为最有价值的一个总成制作 3D。
- 同时启动 Tesla/供应商授权询问；未拿到许可前不抓取、不缓存、不重发布官方 EPC/手册内容。
- 每个部件公开显示覆盖与置信状态：`已核验 / 可能适用 / 未知`，并提供“在 Tesla 官方目录核对”的链接。

如果用户的真正目标是“好玩、能理解车的结构”，上述 MVP 完全可行；如果目标是“替代 Tesla EPC，为任意 Model Y 精确下单或指导维修”，在现有数据和权利条件下不可行，也不应承诺。

## 8. 一手来源索引

所有来源访问日期均为 2026-09-08。

1. [Tesla Service 首页：免费维修与维护资料入口](https://service.tesla.com/)
2. [Tesla：Purchasing Parts and Tools](https://service.tesla.com/en-US/parts-and-tools)
3. [Tesla EPC Terms and Conditions（HTML）](https://service.tesla.com/docs/Public/epc/TermsAndConditions/NON_TABS_en-US.html)
4. [Tesla EPC Terms and Conditions（General Public PDF）](https://service.tesla.com/docs/Public/epc/TermsAndConditions/GENERAL_PUBLIC_en-US.pdf)
5. [Tesla Model Y Service Manual：How to Use this Manual](https://service.tesla.com/docs/ModelY/ServiceManual/en-us/GUID-3DA181F8-CE31-413A-B208-838240CAD3F4.html)
6. [Tesla Model Y Service Manual：Consumable Parts](https://service.tesla.com/docs/ModelY/ServiceManual/en-us/GUID-375EED5D-EB52-47F1-94B4-B7C1CCC64178.html)
7. [Tesla Model Y Service Manual：VIN 解码（2020–2024）](https://service.tesla.com/docs/ModelY/ServiceManual/en-au/air/GUID-0C797294-574D-4EE4-8017-C339A7D58411.html)
8. [Tesla Model Y Service Manual：VIN 解码（2025+）](https://service.tesla.com/docs/ModelY/ServiceManual/2025/fr-ca/GUID-BB4CE449-3F8E-4905-AF4A-96DFA87535B5.html)
9. [Tesla 知识产权声明与 Patent Pledge](https://www.tesla.com/en_ph/legal/additional-resources)
10. [Tesla Model Y Owner's Manual：Copyrights and Trademarks](https://www.tesla.com/ownersmanual/modely/en_us/GUID-59E1B254-DB74-4178-B727-CE12EA84A2F7.html)
11. [Tesla Approved Collision Center Operating Standards](https://service.tesla.com/docs/Public/TeslaApprovedCollisionCenters/Tesla_Body_Repair_Program_Operating_Standards.pdf)
12. [Apple RealityKit：Loading entities from a file](https://developer.apple.com/documentation/realitykit/loading-entities-from-a-file)
13. [Apple RealityKit：Entity](https://developer.apple.com/documentation/realitykit/entity)
14. [Apple RealityKit：InputTargetComponent](https://developer.apple.com/documentation/realitykit/inputtargetcomponent)
15. [Apple SwiftUI：targetedToAnyEntity](https://developer.apple.com/documentation/SwiftUI/Gesture/targetedToAnyEntity%28%29)
16. [Apple RealityKit：Improving the Performance of a RealityKit App](https://developer.apple.com/documentation/realitykit/improving-the-performance-of-a-realitykit-app)
17. [Apple RealityKit：Reducing CPU Utilization](https://developer.apple.com/documentation/realitykit/reducing-cpu-utilization-in-your-realitykit-app)
18. [Apple RealityKit：Reducing GPU Utilization](https://developer.apple.com/documentation/realitykit/reducing-gpu-utilization-in-your-realitykit-app)
19. [Apple Xcode：Doing basic optimization to reduce your app's size](https://developer.apple.com/documentation/xcode/doing-basic-optimization-to-reduce-your-app-s-size)
