const api = require("../../utils/api.js");
const history = require("../../utils/history.js");
const format = require("../../utils/format.js");
const geo = require("../../utils/geo.js");

Page({
  data: { view: null, map: null, loadingRoute: true, routeMessage: "" },

  async onLoad(query) {
    this.id = decodeURIComponent(query.id);
    const cached = history.findDrive(this.id);
    if (cached) this.render(cached);
    try {
      const detail = await api.request(`/v1/drives/${encodeURIComponent(this.id)}`);
      this.render(detail);
      this.setData({ routeMessage: (detail.route || []).length >= 2 ? "" : "TeslaMate 未记录完整轨迹，地图仅展示已有位置。" });
    } catch (error) {
      this.setData({ routeMessage: cached ? "无法读取行程轨迹，地图仅展示已有位置。" : error.message });
    } finally {
      this.setData({ loadingRoute: false });
    }
  },

  render(drive) {
    this.drive = drive;
    const route = (drive.route || []).map(geo.toGcj02);
    const start = route[0] || geo.toGcj02(drive.startLocation);
    const end = route[route.length - 1] || geo.toGcj02(drive.endLocation);
    const markers = [];
    const callout = (content, color) => ({ content, display: "ALWAYS", padding: 6, borderRadius: 12, fontSize: 11, color: "#ffffff", bgColor: color });
    if (start) markers.push({ id: 0, ...start, iconPath: "/assets/icons/route-start.png", width: 18, height: 18, anchor: { x: 0.5, y: 0.5 }, callout: callout(`出发 · ${drive.startLocationName}`, "#07C160") });
    if (end) markers.push({ id: 1, ...end, iconPath: "/assets/icons/route-end.png", width: 18, height: 18, anchor: { x: 0.5, y: 0.5 }, callout: callout(`到达 · ${drive.endLocationName}`, "#10AEFF") });
    const points = route.length >= 2 ? route : [start, end].filter(Boolean);

    const facts = [];
    if (drive.startSocPercent != null && drive.endSocPercent != null) facts.push({ label: "电量变化", value: `${drive.startSocPercent}% → ${drive.endSocPercent}%` });
    if (drive.maxSpeedKph != null) facts.push({ label: "最高速度", value: `${format.fixed(drive.maxSpeedKph, 0)} km/h` });
    if (drive.ascentMeters != null) facts.push({ label: "累计爬升", value: `${format.fixed(drive.ascentMeters, 0)} m` });
    if (drive.descentMeters != null) facts.push({ label: "累计下降", value: `${format.fixed(drive.descentMeters, 0)} m` });
    const environment = [];
    if (drive.outsideTempCelsius != null) environment.push({ label: "平均室外温度", value: `${format.fixed(drive.outsideTempCelsius, 1)} ℃` });
    if (drive.insideTempCelsius != null) environment.push({ label: "平均车内温度", value: `${format.fixed(drive.insideTempCelsius, 1)} ℃` });

    this.setData({
      map: points.length === 0 ? null : {
        markers,
        polyline: route.length >= 2 ? [{ points: route, color: "#07C160", width: 6, borderColor: "#FFFFFF", borderWidth: 2, arrowLine: true }] : [],
        includePoints: points
      },
      view: {
        distance: format.withUnit(drive.distanceKm, 1, "km"),
        start: { name: drive.startLocationName, time: format.dateTime(drive.startedAt), canOpen: Boolean(start) },
        end: { name: drive.endLocationName, time: format.dateTime(drive.endedAt), canOpen: Boolean(end) },
        tiles: [
          { label: "行驶距离", value: format.withUnit(drive.distanceKm, 1, "km") },
          { label: "驾驶时间", value: format.duration(drive.durationMinutes) },
          { label: "本次耗电", value: format.withUnit(drive.energyUsedKwh, 2, "kWh") },
          { label: "平均能耗", value: drive.averageConsumptionWhPerKm == null ? "—" : `${drive.averageConsumptionWhPerKm} Wh/km` }
        ],
        facts,
        environment
      }
    });
    this.endpoints = { start: route[0] ? drive.route[0] : drive.startLocation, end: route.length ? drive.route[drive.route.length - 1] : drive.endLocation };
  },

  openStart() { if (this.endpoints.start) geo.openLocation(this.drive.startLocationName, this.endpoints.start); },
  openEnd() { if (this.endpoints.end) geo.openLocation(this.drive.endLocationName, this.endpoints.end); }
});
