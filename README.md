# Tesla Buddy

一套运行于个人 Mac mini 的本地优先 Tesla 数据服务，以及配套 iOS App。它以现有 TeslaMate 的 PostgreSQL 数据为事实来源，为车主提供状态总览、出行复盘、能耗/充电分析和可执行的用车提醒。

当前处于产品定义与架构设计阶段。完整需求与实施计划见 [docs/PRD.md](docs/PRD.md)。

## 下一步

1. 确认 PRD 中标为“待确认”的范围选择。
2. 初始化单体仓库：本地 API、数据访问层、iOS App 与部署配置。
3. 连接一份脱敏 TeslaMate 数据库，完成端到端 MVP。
