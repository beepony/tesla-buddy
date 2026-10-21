const history = require("../../utils/history.js");
const format = require("../../utils/format.js");
const geo = require("../../utils/geo.js");

Page({
  data: { view: null },

  async onLoad(query) {
    const id = decodeURIComponent(query.id);
    let charge = history.findCharge(id) || getApp().globalData.selectedCharge;
    if (!charge || charge.id !== id) {
      try { charge = (await history.load("charges")).find((item) => item.id === id); } catch (error) { charge = null; }
    }
    if (!charge) {
      this.setData({ missing: true });
      return;
    }
    this.charge = charge;
    const facts = [];
    if (charge.startSocPercent != null && charge.endSocPercent != null) facts.push({ label: "电量变化", value: `${charge.startSocPercent}% → ${charge.endSocPercent}%` });
    if (charge.consumedEnergyKwh != null) facts.push({ label: "电网取电", value: format.withUnit(charge.consumedEnergyKwh, 2, "kWh") });
    facts.push({ label: "充电方式", value: charge.chargingType === "dc" ? "直流快充" : "交流充电" });
    if (charge.cost) facts.push({ label: "本次费用", value: format.currency(charge.cost) });
    this.setData({
      view: {
        tiles: [
          { label: "充入电量", value: format.withUnit(charge.addedEnergyKwh, 2, "kWh") },
          { label: "充电时长", value: format.duration(charge.durationMinutes) },
          { label: "最大功率", value: format.withUnit(charge.maxChargingPowerKw, 0, "kW") },
          { label: "充电效率", value: charge.chargingEfficiencyPercent == null ? "—" : `${format.fixed(charge.chargingEfficiencyPercent, 1)}%` }
        ],
        location: charge.locationName,
        canOpen: Boolean(charge.location),
        start: { time: format.time(charge.startedAt), day: format.monthDay(charge.startedAt) },
        end: { time: format.time(charge.endedAt), day: format.monthDay(charge.endedAt) },
        facts
      }
    });
  },

  openLocation() { if (this.charge && this.charge.location) geo.openLocation(this.charge.locationName, this.charge.location); }
});
