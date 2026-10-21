const history = require("../../utils/history.js");
const format = require("../../utils/format.js");

Page({
  data: { summary: null, charges: [], message: "" },

  async onLoad(query) {
    const title = format.dayTitle(format.fromDateKey(query.date));
    wx.setNavigationBarTitle({ title });
    try {
      const charges = history.onDay(await history.load("charges"), query.date);
      this.setData({ summary: history.chargeSummary(charges, title), charges });
    } catch (error) {
      this.setData({ summary: history.chargeSummary([], title), message: error.message });
    }
  }
});
