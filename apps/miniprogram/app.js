const { version, build } = require("./version.js");

App({
  globalData: { version, build },
  onLaunch() {
    // Pick up new releases without asking the user to delete the mini program.
    if (!wx.getUpdateManager) return;
    const manager = wx.getUpdateManager();
    manager.onUpdateReady(() => {
      wx.showModal({
        title: "发现新版本",
        content: "新版本已经准备好，是否重启使用？",
        success: (result) => { if (result.confirm) manager.applyUpdate(); }
      });
    });
  }
});
