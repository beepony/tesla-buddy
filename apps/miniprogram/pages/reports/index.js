const api = require("../../utils/api.js");
const format = require("../../utils/format.js");
const reports = require("../../utils/report.js");

Page({
  data: { periods: reports.PERIODS, kind: "month", anchor: Date.now(), anchorText: "", title: "", highlight: null, templates: reports.TEMPLATES, message: "", synced: false },

  onLoad() { this.load(); },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    const { kind, anchor } = this.data;
    this.setData({ title: reports.periodTitle(kind, anchor), anchorText: format.dateKey(new Date(anchor)) });
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    try {
      const vehicle = await api.firstVehicle();
      if (!vehicle) throw new Error("尚未发现车辆");
      const range = reports.interval(kind, anchor);
      const query = `vehicleId=${encodeURIComponent(vehicle.id)}&start=${encodeURIComponent(range.start.toISOString())}&end=${encodeURIComponent(range.end.toISOString())}`;
      const report = await api.request(`/v1/reports/summary?${query}`);
      if (requestId !== this.requestId) return;
      getApp().globalData.report = report;
      const metrics = report.metrics;
      this.setData({
        synced: true,
        message: "",
        highlight: metrics.distanceKm > 0 ? [
          { value: `${format.fixed(metrics.distanceKm, 0)} km`, label: "驾驶距离" },
          { value: `${format.fixed(metrics.chargedEnergyKwh, 1)} kWh`, label: "补能电量" },
          { value: `${Math.floor(metrics.drivingMinutes)} 分`, label: "驾驶时间" }
        ] : null
      });
    } catch (error) {
      if (requestId !== this.requestId) return;
      this.setData({ message: `报告数据暂时无法读取：${error.message}` });
    }
  },

  changeKind(event) {
    this.setData({ kind: event.detail.value });
    this.load();
  },
  previous() { this.shift(-1); },
  next() { this.shift(1); },
  shift(offset) {
    this.setData({ anchor: reports.move(this.data.kind, this.data.anchor, offset).getTime() });
    this.load();
  },
  pickDate(event) {
    this.setData({ anchor: format.fromDateKey(event.detail.value).getTime() });
    this.load();
  },
  openTemplate(event) {
    wx.navigateTo({ url: `/pages/report-detail/index?id=${event.currentTarget.dataset.id}` });
  }
});
