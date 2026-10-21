const config = loadConfig();

function loadConfig() {
  try {
    return require("../config.js");
  } catch (error) {
    return { baseURLs: [], apiToken: "", missing: true };
  }
}

const NETWORK_HINT = "无法连接 Tesla Buddy 服务。请确认服务器在线、域名已在小程序后台登记，并检查网络连接。";

function requestOnce(baseURL, path, options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseURL.replace(/\/$/, "") + path,
      method: options.method || "GET",
      data: options.data,
      timeout: options.timeout || 15000,
      header: { Authorization: `Bearer ${config.apiToken}`, "content-type": "application/json" },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300 && response.data && "data" in response.data) {
          resolve(response.data.data);
        } else {
          const error = new Error(response.statusCode === 401 ? "API token 不正确，请检查 config.js。" : `服务器暂时不可用（错误 ${response.statusCode}）。`);
          error.statusCode = response.statusCode;
          error.code = response.data && response.data.error;
          reject(error);
        }
      },
      fail(error) {
        const wrapped = new Error(NETWORK_HINT);
        wrapped.network = true;
        wrapped.detail = error.errMsg;
        reject(wrapped);
      }
    });
  });
}

/** Tries every configured host in order, like the iOS client did. */
async function request(path, options = {}) {
  if (config.missing || !config.baseURLs || config.baseURLs.length === 0) {
    throw new Error("尚未配置服务器地址。请把 config.example.js 复制为 config.js 并填写。");
  }
  let lastError;
  for (const baseURL of config.baseURLs) {
    try {
      return await requestOnce(baseURL, path, options);
    } catch (error) {
      lastError = error;
      // A real HTTP answer means the host is reachable; do not retry elsewhere.
      if (!error.network) throw error;
    }
  }
  throw lastError;
}

let vehiclePromise = null;
let vehiclePromiseAt = 0;

/** All pages show the first vehicle; share one lookup for a short time. */
function firstVehicle(force = false) {
  if (force || !vehiclePromise || Date.now() - vehiclePromiseAt > 30000) {
    vehiclePromiseAt = Date.now();
    vehiclePromise = request("/v1/vehicles").then((vehicles) => vehicles[0] || null);
    vehiclePromise.catch(() => { vehiclePromise = null; });
  }
  return vehiclePromise;
}

function login() {
  return new Promise((resolve, reject) => {
    wx.login({ success: (result) => resolve(result.code), fail: () => reject(new Error("微信登录失败，请稍后再试。")) });
  });
}

module.exports = { request, firstVehicle, login, config, NETWORK_HINT };
