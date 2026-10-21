const history = require("../../utils/history.js");
const format = require("../../utils/format.js");

Page({
  data: { summary: null, drives: [], message: "" },

  async onLoad(query) {
    const title = format.dayTitle(format.fromDateKey(query.date));
    wx.setNavigationBarTitle({ title });
    try {
      const drives = history.onDay(await history.load("drives"), query.date);
      this.setData({ summary: history.driveSummary(drives, title), drives });
    } catch (error) {
      this.setData({ summary: history.driveSummary([], title), message: error.message });
    }
  }
});
