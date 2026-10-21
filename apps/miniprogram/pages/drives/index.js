const history = require("../../utils/history.js");
const format = require("../../utils/format.js");
const geo = require("../../utils/geo.js");

const MODES = [{ value: "calendar", label: "日历" }, { value: "map", label: "足迹" }];

Page({
  data: {
    modes: MODES, mode: "calendar", month: Date.now(), summary: null, counts: {},
    places: [], markers: [], includePoints: [], message: "", loaded: false
  },

  onLoad() { this.drives = []; this.load(); },

  async onPullDownRefresh() {
    await this.load(true);
    wx.stopPullDownRefresh();
  },

  async load(force = false) {
    try {
      this.drives = await history.load("drives", force);
      if (!this.choseMonth && this.drives.length > 0) {
        this.choseMonth = true;
        const latest = new Date(this.drives[0].startedAt);
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
    const monthDrives = history.inMonth(this.drives, month);
    const places = this.places(monthDrives);
    const markers = places.map((place, index) => ({
      id: index,
      latitude: place.point.latitude,
      longitude: place.point.longitude,
      title: place.name,
      iconPath: "/assets/icons/marker.png",
      width: 28,
      height: 34,
      callout: { content: `${place.name} · ${place.drives.length} 次`, display: "BYCLICK", padding: 8, borderRadius: 8, fontSize: 13 }
    }));
    this.setData({
      summary: history.driveSummary(monthDrives, format.monthTitle(month)),
      counts: history.countByDay(monthDrives),
      places: places.map((place) => ({ name: place.name, count: place.drives.length })),
      markers,
      includePoints: markers.map(({ latitude, longitude }) => ({ latitude, longitude }))
    });
    this.monthPlaces = places;
  },

  // Group trip destinations into "lit up" places, as the iOS footprint map did.
  places(drives) {
    const groups = new Map();
    for (const drive of drives) {
      if (!drive.endLocation) continue;
      const key = `${drive.endLocationName}|${Math.round(drive.endLocation.latitude * 10000)}|${Math.round(drive.endLocation.longitude * 10000)}`;
      if (!groups.has(key)) groups.set(key, { name: drive.endLocationName, point: geo.toGcj02(drive.endLocation), drives: [] });
      groups.get(key).drives.push(drive);
    }
    return Array.from(groups.values());
  },

  changeMonth(event) {
    const month = format.addMonths(new Date(this.data.month), event.detail.offset);
    this.setData({ month: month.getTime() });
    this.render();
  },

  changeMode(event) { this.setData({ mode: event.detail.value }); },

  openDay(event) {
    wx.navigateTo({ url: `/pages/drive-day/index?date=${event.detail.date}` });
  },

  openPlace(event) {
    const index = event.detail.markerId !== undefined ? event.detail.markerId : event.currentTarget.dataset.index;
    const place = this.monthPlaces[index];
    if (!place) return;
    getApp().globalData.placeDrives = { name: place.name, ids: place.drives.map((drive) => drive.id) };
    wx.navigateTo({ url: "/pages/place-drives/index" });
  }
});
