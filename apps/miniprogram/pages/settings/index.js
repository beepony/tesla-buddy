const api = require("../../utils/api.js");
const store = require("../../utils/store.js");
const wifi = require("../../utils/wifi.js");

Page({
  data: {
    notify: { loading: true, configured: false, credits: 0, message: "" },
    chargingCard: true,
    keepScreenOn: false,
    wifi: { ssid: wifi.SSID, connecting: false, message: "", failed: false, copied: false }
  },

  onLoad() {
    this.setData({ chargingCard: store.get("chargingCard", true), keepScreenOn: store.get("keepScreenOn", false) });
  },

  onShow() { this.loadSubscription(); },

  async loadSubscription() {
    try {
      const config = await api.request("/v1/wechat/config");
      this.templateId = config.templateId;
      if (!config.configured) {
        this.setData({ notify: { loading: false, configured: false, credits: 0, message: "服务器尚未配置订阅消息模板，暂不能推送。" } });
        return;
      }
      const status = await api.request("/v1/wechat/subscriptions/status", { method: "POST", data: { code: await api.login() } });
      this.setData({ notify: { loading: false, configured: true, credits: status.credits, message: "" } });
    } catch (error) {
      this.setData({ notify: { loading: false, configured: false, credits: 0, message: error.message } });
    }
  },

  // Must run directly from the tap: WeChat only shows the prompt for user gestures.
  subscribe() {
    if (!this.templateId) return;
    wx.requestSubscribeMessage({
      tmplIds: [this.templateId],
      success: async (result) => {
        const choice = result[this.templateId];
        if (choice !== "accept") {
          const message = choice === "ban"
            ? "订阅消息已被关闭。请在小程序右上角「···> 设置 > 通知管理」中开启。"
            : "你没有允许本次提醒。";
          this.setData({ "notify.message": message });
          return;
        }
        try {
          const status = await api.request("/v1/wechat/subscriptions/subscribe", { method: "POST", data: { code: await api.login() } });
          this.setData({ "notify.credits": status.credits, "notify.message": "" });
          wx.showToast({ title: "已订阅", icon: "success" });
        } catch (error) {
          this.setData({ "notify.message": `订阅保存失败：${error.message}` });
        }
      },
      fail: (error) => {
        this.setData({ "notify.message": error.errCode === 20004 ? "你已在微信中关闭本小程序的消息，请到「···> 设置」中开启。" : `无法请求订阅：${error.errMsg}` });
      }
    });
  },

  async unsubscribe() {
    try {
      const status = await api.request("/v1/wechat/subscriptions/unsubscribe", { method: "POST", data: { code: await api.login() } });
      this.setData({ "notify.credits": status.credits });
    } catch (error) {
      this.setData({ "notify.message": error.message });
    }
  },

  openWechatSettings() { wx.openSetting({}); },

  toggleChargingCard(event) {
    store.set("chargingCard", event.detail.value);
    this.setData({ chargingCard: event.detail.value });
  },

  toggleKeepScreenOn(event) {
    store.set("keepScreenOn", event.detail.value);
    this.setData({ keepScreenOn: event.detail.value });
    if (!event.detail.value) wx.setKeepScreenOn({ keepScreenOn: false });
  },

  async connectWifi() {
    this.setData({ "wifi.connecting": true, "wifi.message": "", "wifi.failed": false });
    try {
      const message = await wifi.connect();
      this.setData({ "wifi.message": message });
    } catch (error) {
      this.setData({ "wifi.message": error.message, "wifi.failed": true });
    } finally {
      this.setData({ "wifi.connecting": false });
    }
  },

  async copyPassword() {
    await wifi.copyPassword();
    this.setData({ "wifi.copied": true });
  }
});
