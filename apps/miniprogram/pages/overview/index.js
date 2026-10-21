const api = require("../../utils/api.js");
const vehicleView = require("../../utils/vehicle.js");
const charging = require("../../utils/charging.js");
const store = require("../../utils/store.js");

Page({
  data: { vehicle: null, loading: true, error: "", chargingCard: null, showCharging: false },

  onLoad() {
    this.poller = charging.createPoller(this);
  },

  onShow() {
    this.load();
    this.timer = setInterval(() => this.load(), 60000);
    const showCharging = store.get("chargingCard", true);
    this.setData({ showCharging });
    if (showCharging) this.poller.start();
  },

  onHide() { this.stopTimers(); },
  onUnload() { this.stopTimers(); },
  stopTimers() {
    clearInterval(this.timer);
    this.poller.stop();
  },

  async onPullDownRefresh() {
    await this.load(true);
    wx.stopPullDownRefresh();
  },

  async load(force = false) {
    if (this.busy) return;
    this.busy = true;
    this.setData({ loading: true });
    try {
      const first = await api.firstVehicle(force);
      if (!first) {
        this.raw = null;
        this.setData({ vehicle: null, error: "TeslaMate 尚未返回车辆。请确认 Tesla 账户授权已完成。" });
        return;
      }
      const overview = await api.request(`/v1/vehicles/${encodeURIComponent(first.id)}/overview`);
      this.raw = overview;
      getApp().globalData.vehicle = overview;
      getApp().globalData.vehicleError = "";
      this.setData({ vehicle: vehicleView.present(overview), error: "" });
    } catch (error) {
      getApp().globalData.vehicleError = error.message;
      const vehicle = this.raw ? vehicleView.present(this.raw, error.message) : null;
      this.setData({ vehicle, error: error.message });
    } finally {
      this.busy = false;
      this.setData({ loading: false });
    }
  },

  retry() { this.load(true); },

  openUpdate() { wx.navigateTo({ url: "/pages/software-update/index" }); },
  openCharges() { wx.switchTab({ url: "/pages/charges/index" }); },

  onShareAppMessage() {
    return { title: "Tesla Buddy", path: "/pages/overview/index" };
  }
});
