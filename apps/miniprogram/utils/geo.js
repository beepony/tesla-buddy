// TeslaMate stores GPS (WGS-84) coordinates; Tencent maps in mainland China use
// GCJ-02, so convert before drawing markers or opening the map.
const A = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  ret += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
  ret += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
  return ret;
}

function transformLng(x, y) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  ret += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
  ret += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
  return ret;
}

function toGcj02(location) {
  if (!location) return null;
  const { latitude, longitude } = location;
  if (outOfChina(latitude, longitude)) return { latitude, longitude };
  let dLat = transformLat(longitude - 105, latitude - 35);
  let dLng = transformLng(longitude - 105, latitude - 35);
  const radLat = latitude / 180 * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / ((A * (1 - EE)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180) / (A / sqrtMagic * Math.cos(radLat) * Math.PI);
  return { latitude: latitude + dLat, longitude: longitude + dLng };
}

/** Opens WeChat's built-in map page, which offers navigation apps. */
function openLocation(name, location) {
  const point = toGcj02(location);
  if (!point) return;
  wx.openLocation({ latitude: point.latitude, longitude: point.longitude, name, scale: 16 });
}

module.exports = { toGcj02, openLocation, outOfChina };
