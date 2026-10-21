const format = require("../../utils/format.js");

Component({
  options: { styleIsolation: "apply-shared" },
  properties: { charge: { type: Object, value: null } },
  data: { view: null },
  observers: {
    charge(charge) {
      if (!charge) return;
      const soc = charge.startSocPercent != null && charge.endSocPercent != null ? `${charge.startSocPercent}% → ${charge.endSocPercent}%` : "";
      this.setData({
        view: {
          dc: charge.chargingType === "dc",
          type: charge.chargingType === "dc" ? "直流快充" : "交流充电",
          location: charge.locationName,
          time: format.dateTime(charge.startedAt),
          soc,
          cost: charge.cost ? format.currency(charge.cost) : "",
          energy: format.withUnit(charge.addedEnergyKwh, 2, "kWh"),
          duration: format.duration(charge.durationMinutes),
          power: format.withUnit(charge.maxChargingPowerKw, 0, "kW")
        }
      });
    }
  },
  methods: {
    open() {
      getApp().globalData.selectedCharge = this.data.charge;
      wx.navigateTo({ url: `/pages/charge-detail/index?id=${encodeURIComponent(this.data.charge.id)}` });
    }
  }
});
