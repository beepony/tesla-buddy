const reports = require("../../utils/report.js");

Page({
  data: { template: null, detail: null },
  onLoad(query) {
    const template = reports.TEMPLATES.find((item) => item.id === query.id) || reports.TEMPLATES[0];
    wx.setNavigationBarTitle({ title: template.title });
    this.setData({ template, detail: reports.detailRows(template.id, getApp().globalData.report) });
  }
});
