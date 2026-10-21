const history = require("../../utils/history.js");

Page({
  data: { drives: [] },
  onLoad() {
    const place = getApp().globalData.placeDrives || { name: "地点", ids: [] };
    wx.setNavigationBarTitle({ title: place.name });
    const drives = place.ids.map(history.findDrive).filter(Boolean)
      .sort((left, right) => new Date(right.startedAt) - new Date(left.startedAt));
    this.setData({ drives });
  }
});
