const api = require("../../utils/api.js");
const format = require("../../utils/format.js");
const store = require("../../utils/store.js");

Page({
  data: { loading: true, current: null, currentIsHome: false, completed: [], homeKey: "", homeName: "", message: "" },

  onLoad() { this.sessions = []; },

  onShow() {
    this.load();
    // Elapsed parking time ticks every minute, like the iOS TimelineView.
    this.timer = setInterval(() => this.render(), 60000);
  },
  onHide() { clearInterval(this.timer); },
  onUnload() { clearInterval(this.timer); },

  async onPullDownRefresh() {
    await this.load(true);
    wx.stopPullDownRefresh();
  },

  async load(force = false) {
    this.setData({ loading: true });
    try {
      const vehicle = await api.firstVehicle(force);
      if (!vehicle) throw new Error("尚未发现车辆");
      this.sessions = await api.request(`/v1/vehicles/${encodeURIComponent(vehicle.id)}/parking-sessions`);
      this.setData({ message: "" });
    } catch (error) {
      this.setData({ message: error.network ? "无法读取停车数据。请确认服务器在线并检查网络连接。" : error.message });
    }
    this.setData({ loading: false });
    this.render();
  },

  render() {
    const homeKey = store.get("homeLocationKey", "");
    const isHome = (session) => Boolean(homeKey) && session.locationKey === homeKey;
    const current = this.sessions.find((session) => session.isActive);
    const homeSession = this.sessions.find((session) => session.locationKey === homeKey);
    this.setData({
      homeKey,
      homeName: homeSession ? homeSession.locationName : (homeKey ? "已设置" : ""),
      currentIsHome: Boolean(current && isHome(current)),
      current: current ? {
        location: current.locationName,
        start: format.dateTime(current.startedAt),
        elapsed: format.parkingDuration((Date.now() - new Date(current.startedAt)) / 60000)
      } : null,
      completed: this.sessions.filter((session) => !session.isActive && !isHome(session)).map((session) => ({
        id: session.id,
        location: session.locationName,
        duration: format.parkingDuration(session.durationMinutes),
        range: `${format.dateTime(session.startedAt)} 至 ${session.endedAt ? format.dateTime(session.endedAt) : "现在"}`
      }))
    });
  },

  chooseHome() {
    const seen = new Set();
    const locations = this.sessions.filter((session) => !seen.has(session.locationKey) && seen.add(session.locationKey));
    const homeKey = store.get("homeLocationKey", "");
    if (locations.length === 0 && !homeKey) {
      wx.showToast({ title: "暂无可选地点", icon: "none" });
      return;
    }
    // Action sheets allow at most 6 items; keep the most recent places.
    const choices = locations.slice(0, homeKey ? 5 : 6);
    const itemList = choices.map((session) => (session.locationKey === homeKey ? `✓ ${session.locationName}` : session.locationName));
    if (homeKey) itemList.push("清除家庭位置");
    wx.showActionSheet({
      alertText: "选择家庭位置",
      itemList,
      itemColor: "#000000",
      success: ({ tapIndex }) => {
        store.set("homeLocationKey", tapIndex < choices.length ? choices[tapIndex].locationKey : "");
        this.render();
      }
    });
  }
});
