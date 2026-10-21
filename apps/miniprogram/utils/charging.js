// Current charging session, refreshed every 15 seconds while a page is visible
// (replaces the iOS Live Activity, which has no mini program counterpart).
const api = require("./api.js");
const format = require("./format.js");
const store = require("./store.js");

const STATUS_TEXT = { charging: "正在充电", paused: "暂无充电功率", ended: "充电已结束", stale: "数据待刷新" };

function present(status, error, loading, now = new Date()) {
  if (error) {
    const base = status ? present(status, null, false, now) : { active: false };
    return { ...base, badge: "连接待恢复", error };
  }
  if (!status || status.endedAt) {
    return { active: false, badge: "未在充电", hint: loading ? "正在读取车辆充电状态…" : "当前没有进行中的充电，开始充电后打开小程序即可查看。" };
  }
  const stale = new Date(status.freshUntil) <= now;
  const until = stale ? new Date(status.updatedAt) : now;
  const minutes = Math.max(0, Math.floor((until - new Date(status.startedAt)) / 60000));
  return {
    active: true,
    badge: stale ? "数据待刷新" : STATUS_TEXT[status.state] || "等待充电数据",
    percent: status.batteryPercent == null ? "—" : `${status.batteryPercent}%`,
    percentValue: status.batteryPercent || 0,
    elapsed: `${Math.floor(minutes / 60)}小时${minutes % 60}分`,
    elapsedLabel: stale ? "截至上次采样" : "本次连接时长",
    power: status.powerKw == null ? "—" : `${format.fixed(status.powerKw, 1)} kW`,
    added: status.addedEnergyKwh == null ? "充入电量 —" : `已充 ${format.fixed(status.addedEnergyKwh, 1)} kWh`,
    sampled: `${format.dateTime(status.updatedAt)}:${String(new Date(status.updatedAt).getSeconds()).padStart(2, "0")}`,
    charging: status.state === "charging" && !stale
  };
}

/** Attach to a page: call start() in onShow and stop() in onHide/onUnload. */
function createPoller(page, key = "chargingCard") {
  let timer = null;
  let ticker = null;
  let status = null;
  let error = null;
  let busy = false;

  const render = (loading = false) => {
    page.setData({ [key]: present(status, error, loading) });
    // Keep the phone awake on the charging page when the user opted in.
    if (store.get("keepScreenOn", false)) wx.setKeepScreenOn({ keepScreenOn: Boolean(status && !status.endedAt) });
  };

  const refresh = async () => {
    if (busy) return;
    busy = true;
    render(true);
    try {
      const vehicle = await api.firstVehicle();
      status = vehicle ? await api.request(`/v1/vehicles/${encodeURIComponent(vehicle.id)}/charging-status`) : null;
      error = vehicle ? null : "尚未发现车辆";
    } catch (failure) {
      // Keep the last reading instead of claiming the charge ended.
      error = "充电数据暂未连接，显示的可能是上次读数。";
    } finally {
      busy = false;
      render(false);
    }
  };

  return {
    refresh,
    start() {
      this.stop();
      refresh();
      timer = setInterval(refresh, 15000);
      ticker = setInterval(() => render(false), 1000 * 30);
    },
    stop() {
      clearInterval(timer);
      clearInterval(ticker);
      timer = null;
      ticker = null;
      if (store.get("keepScreenOn", false)) wx.setKeepScreenOn({ keepScreenOn: false });
    }
  };
}

module.exports = { present, createPoller };
