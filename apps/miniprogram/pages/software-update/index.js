const api = require("../../utils/api.js");
const format = require("../../utils/format.js");
const vehicleView = require("../../utils/vehicle.js");

const GUIDE_URL = "https://www.tesla.com/support/software-updates";

Page({
  data: { loading: true, view: null, error: "" },

  // Opened from the overview or from a subscribe message, so load on its own.
  async onLoad() {
    const app = getApp();
    if (app.globalData.vehicle) this.render(app.globalData.vehicle, app.globalData.vehicleError);
    try {
      const first = await api.firstVehicle(true);
      if (first) this.render(await api.request(`/v1/vehicles/${encodeURIComponent(first.id)}/overview`), "");
    } catch (error) {
      if (app.globalData.vehicle) this.render(app.globalData.vehicle, error.message);
      else this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  render(vehicle, refreshError) {
    let guide;
    if (refreshError) guide = "暂时无法刷新更新状态，请检查网络连接后返回概览刷新。";
    else if (vehicle.updateStatus === "available") guide = "车辆上次同步时有软件更新可用。请打开 Tesla 官方 App 的「软件更新」，或在车机中进入「控制 > 软件」查看、安装或预约更新。";
    else if (vehicle.updateStatus === "no_update") guide = "车辆上次同步时没有待安装更新。软件按车型和地区分批推送，收到推送后这里会显示提示。";
    else guide = "暂未获取到车辆的更新状态。车辆同步后可再次刷新，也可在 Tesla 官方 App 或车机「控制 > 软件」中查看。";
    this.setData({
      view: {
        current: vehicle.softwareVersion || "暂无记录",
        status: refreshError ? "更新状态待刷新" : vehicleView.updateTitle(vehicle.updateStatus),
        hasUpdate: !refreshError && vehicle.updateStatus === "available",
        target: vehicle.availableSoftwareVersion || "车辆尚未提供版本号",
        guide,
        receivedAt: !refreshError && vehicle.softwareUpdateReceivedAt ? format.dateTime(vehicle.softwareUpdateReceivedAt) : ""
      }
    });
  },

  copyGuide() {
    // Mini programs cannot open arbitrary web pages without a business domain.
    wx.setClipboardData({ data: GUIDE_URL, success: () => wx.showToast({ title: "链接已复制", icon: "success" }) });
  }
});
