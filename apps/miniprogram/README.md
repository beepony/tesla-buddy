# Tesla Buddy 微信小程序

原生微信小程序（WXML / WXSS / JS，无需 npm 构建），读取与 iOS App 相同的 Tesla Buddy API，所有 TeslaMate 数据保持不变。

## 功能对照

| iOS App | 小程序 |
| --- | --- |
| 概览、胎压、关键数据、系统版本详情 | 同名页面；60 秒自动刷新，支持下拉刷新 |
| 行程日历、足迹地图、按天列表、轨迹详情 | 腾讯地图 `<map>` 绘制轨迹与地点，坐标自动由 WGS-84 转为 GCJ-02 |
| 充电状态、月度汇总、日历 / 列表、充电详情 | 同名页面；页面打开时每 15 秒刷新当前充电 |
| 停车与家庭位置 | 家庭位置保存在小程序本地存储 |
| 用车报告与四类深入报告 | 按日 / 周 / 月切换，日期选择器 |
| 软件更新本地通知 + 后台刷新 | 微信订阅消息，由服务器每 5 分钟检查后推送，未打开小程序也能收到 |
| 灵动岛 / 锁屏实时活动 | 小程序无此能力；改为概览充电卡片和充电时屏幕常亮选项 |
| 服务中心 Wi-Fi 描述文件 | `wx.connectWifi` 一键加入「Tesla Service」，也可复制密码 |
| Apple 地图 / 高德跳转 | 微信内置地图页 `wx.openLocation`，可选择导航应用 |

界面遵循微信小程序设计规范（WeUI）：灰色页面底、白色分组列表、细分隔线、微信绿单一强调色、系统字体，并适配深色模式与底部安全区。

## 首次配置

1. 在 [微信公众平台](https://mp.weixin.qq.com/) 注册小程序（个人主体即可），记下 AppID。
2. API 需要 HTTPS 域名。在「开发管理 > 开发设置 > 服务器域名」的 request 合法域名中登记，例如经 Tailscale Funnel 或反向代理暴露的 `https://tesla.example.com`。
3. 复制配置并填写服务器地址与 API token（`config.js` 已被 git 忽略）：

   ```sh
   cp apps/miniprogram/config.example.js apps/miniprogram/config.js
   ```

4. 用微信开发者工具导入 `apps/miniprogram`，把 `project.config.json` 中的 `touristappid` 换成自己的 AppID（或在导入时填写）。
5. 本地联调可在开发者工具「详情 > 本地设置」勾选「不校验合法域名」，并把 `config.js` 指向 `http://127.0.0.1:8787`。

## 软件更新提醒（可选）

1. 小程序后台「基础功能 > 订阅消息」选用一次性订阅模板（如「版本更新提醒」），记下模板 ID 与关键词名称。
2. 在服务器 `.env` 中配置 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`WECHAT_UPDATE_TEMPLATE_ID`；如关键词不是 `thing1 / character_string2 / thing3`，用 `WECHAT_UPDATE_TEMPLATE_DATA` 重新映射。
3. `WECHAT_SUBSCRIPTION_STORE` 指向可写且持久的路径（Docker 部署时挂载卷），保存订阅次数。
4. 在「我的 > 设置 > 通知」点「订阅」。微信规定每次同意只能推送一次，可多次点击累积。

AppSecret 只放在服务器；小程序只发送 `wx.login` 临时 code，由服务器换取 openid。

## 测试与发布

```sh
npm test                                   # 包含 apps/miniprogram/test 中的工具函数测试
node scripts/build-miniprogram-icons.mjs   # 修改图标后重新生成 PNG（需要 rsvg-convert）
```

在开发者工具中预览、真机调试后点击「上传」，版本号填 `version.js` 中的 `version`，再到小程序后台提交体验版或审核。个人自用可直接使用体验版，无需公开发布。
