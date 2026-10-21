// Small persistent preferences, the mini program counterpart of UserDefaults.
const KEYS = {
  homeLocationKey: "teslaBuddy.homeLocationKey",
  chargingCard: "teslaBuddy.chargingCardEnabled",
  keepScreenOn: "teslaBuddy.keepScreenOnWhileCharging"
};

function get(name, fallback) {
  const value = wx.getStorageSync(KEYS[name]);
  return value === "" || value === undefined ? fallback : value;
}

function set(name, value) {
  wx.setStorageSync(KEYS[name], value);
}

module.exports = { get, set };
