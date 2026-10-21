const history = require("../../utils/history.js");
const format = require("../../utils/format.js");
const charging = require("../../utils/charging.js");

const MODES = [{ value: "calendar", label: "日历" }, { value: "list", label: "列表" }];

Page({
  data: { modes: MODES, mode: "calendar", month: Date.now(), summary: null, counts: {}, days: [], total: 0, message: "", chargingCard: null, loaded: false },

  onLoad() {
    this.charges = [];
    this.poller = charging.createPoller(this);
    this.load();
  },

  onShow() { this.poller.start(); },
  onHide() { this.poller.stop(); },
  onUnload() { this.poller.stop(); },

  async onPullDownRefresh() {
    await Promise.all([this.poller.refresh(), this.load(true)]);
    wx.stopPullDownRefresh();
  },

  async load(force = false) {
    try {
      this.charges = await history.load("charges", force);
      if (!this.choseMonth && this.charges.length > 0) {
        this.choseMonth = true;
        const latest = new Date(this.charges[0].startedAt);
        this.setData({ month: new Date(latest.getFullYear(), latest.getMonth(), 1).getTime() });
      }
      this.setData({ message: "" });
    } catch (error) {
      this.setData({ message: error.message });
    }
    this.setData({ loaded: true });
    this.render();
  },

  render() {
    const month = new Date(this.data.month);
    const monthCharges = history.inMonth(this.charges, month);
    const keys = Array.from(new Set(monthCharges.map((charge) => format.dateKey(charge.startedAt)))).sort().reverse();
    const days = keys.map((key) => {
      const charges = history.onDay(monthCharges, key);
      const energy = charges.reduce((sum, charge) => sum + charge.addedEnergyKwh, 0);
      return { key, title: format.dayTitle(format.fromDateKey(key)), detail: `${charges.length} 次 · ${format.fixed(energy, 2)} kWh`, charges };
    });
    this.setData({
      total: this.charges.length,
      summary: history.chargeSummary(monthCharges, format.monthTitle(month)),
      counts: history.countByDay(monthCharges),
      days
    });
  },

  changeMonth(event) {
    this.setData({ month: format.addMonths(new Date(this.data.month), event.detail.offset).getTime() });
    this.render();
  },

  changeMode(event) { this.setData({ mode: event.detail.value }); },

  openDay(event) { wx.navigateTo({ url: `/pages/charge-day/index?date=${event.detail.date}` }); }
});
