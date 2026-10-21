const format = require("../../utils/format.js");

Component({
  options: { styleIsolation: "apply-shared" },
  properties: { drive: { type: Object, value: null } },
  data: { view: null },
  observers: {
    drive(drive) {
      if (!drive) return;
      this.setData({
        view: {
          start: drive.startLocationName,
          end: drive.endLocationName,
          time: format.dateTime(drive.startedAt),
          energy: format.withUnit(drive.energyUsedKwh, 2, "kWh"),
          consumption: drive.averageConsumptionWhPerKm == null ? "—" : `${drive.averageConsumptionWhPerKm} Wh/km`,
          distance: format.withUnit(drive.distanceKm, 1, "km")
        }
      });
    }
  },
  methods: {
    open() { wx.navigateTo({ url: `/pages/drive-detail/index?id=${encodeURIComponent(this.data.drive.id)}` }); }
  }
});
