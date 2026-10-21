// Tesla service center Wi-Fi. Mini programs may join a network directly with
// wx.connectWifi, so no configuration profile is needed any more.
const SSID = "Tesla Service";
const PASSWORD = "*U17r4H4rd*(Or3";

const ERRORS = {
  12005: "请先打开手机 Wi-Fi。",
  12006: "请先打开手机定位服务。",
  12002: "密码错误，请复制密码后手动连接。",
  12003: "连接超时，请确认已在服务中心附近。",
  12004: "重复连接，请稍后再试。",
  12007: "你已拒绝加入网络。",
  12010: "系统暂不支持，请复制密码后手动连接。",
  12013: "系统保存的网络配置有误，请在系统设置中忽略「Tesla Service」后重试。"
};

function call(name, options = {}) {
  return new Promise((resolve, reject) => wx[name]({ ...options, success: resolve, fail: reject }));
}

async function connect() {
  try {
    await call("startWifi");
    await call("connectWifi", { SSID, password: PASSWORD, maunal: false, partialInfo: false });
    return "已连接「Tesla Service」。";
  } catch (error) {
    throw new Error(ERRORS[error.errCode] || `连接失败：${error.errMsg || "未知错误"}`);
  }
}

function copyPassword() {
  return call("setClipboardData", { data: PASSWORD });
}

module.exports = { SSID, connect, copyPassword };
