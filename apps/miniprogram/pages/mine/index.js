Page({
  data: { version: "" },
  onLoad() {
    const { version, build } = getApp().globalData;
    this.setData({ version: `${version} (${build})` });
  },
  openReports() { wx.navigateTo({ url: "/pages/reports/index" }); },
  openSettings() { wx.navigateTo({ url: "/pages/settings/index" }); }
});
