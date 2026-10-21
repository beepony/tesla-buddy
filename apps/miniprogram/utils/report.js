// Report periods and the four "deep dive" templates from the iOS app.
const format = require("./format.js");

const PERIODS = [{ value: "day", label: "按日" }, { value: "week", label: "按周" }, { value: "month", label: "按月" }];

function interval(kind, anchor) {
  const date = new Date(anchor);
  if (kind === "day") {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) };
  }
  if (kind === "week") {
    // Weeks start on Monday, the Chinese calendar convention.
    const offset = (date.getDay() + 6) % 7;
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) };
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
}

function move(kind, anchor, offset) {
  const date = new Date(anchor);
  if (kind === "day") return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
  if (kind === "week") return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset * 7);
  return new Date(date.getFullYear(), date.getMonth() + offset, Math.min(date.getDate(), 28));
}

function periodTitle(kind, anchor) {
  const label = PERIODS.find((period) => period.value === kind).label;
  return `${label} · ${kind === "month" ? format.monthTitle(anchor) : format.monthDay(anchor)}`;
}

const TEMPLATES = [
  { id: "efficiency", title: "驾驶效率", summary: "能耗、耗电与温度表现", detail: "积累行程后，将展示 Wh/km、耗电量与温度关联。", icon: "gauge" },
  { id: "battery-health", title: "电池健康", summary: "长期观察电池容量与衰减", detail: "积累充电及满电附近的状态后，将估算可用容量和长期趋势。", icon: "heart" },
  { id: "trip-map", title: "出行足迹", summary: "回顾路线与常用目的地", detail: "完成行程后，自动汇总起终点和里程分布。", icon: "map" },
  { id: "usage-rhythm", title: "用车节奏", summary: "驾驶时长与出行频率", detail: "从已记录行程中了解日常出行节奏。", icon: "rhythm" }
];

function detailRows(id, report) {
  const metrics = report ? report.metrics : null;
  const value = (picked, render) => (picked === null || picked === undefined ? "暂无数据" : render(picked));
  switch (id) {
    case "efficiency":
      return { rows: [
        { label: "平均能耗", value: value(metrics && metrics.averageConsumptionWhPerKm, (v) => `${v} Wh/km`) },
        { label: "累计耗电", value: value(metrics && metrics.energyUsedKwh, (v) => `${format.fixed(v, 2)} kWh`) },
        { label: "平均室外温度", value: value(metrics && metrics.averageOutsideTempCelsius, (v) => `${format.fixed(v, 1)} ℃`) }
      ] };
    case "battery-health":
      return {
        rows: [
          { label: "估算可用容量", value: value(metrics && metrics.estimatedBatteryCapacityKwh, (v) => `${format.fixed(v, 1)} kWh`) },
          { label: "预计最大续航", value: value(metrics && metrics.estimatedMaxRangeKm, (v) => `${format.fixed(v, 0)} km`) }
        ],
        note: "容量根据 TeslaMate 最近一次有效充电记录的充入电量与电量变化估算，不等同于官方标称容量；随着更多完整充电记录累积，结果会更稳定。"
      };
    case "trip-map": {
      const routes = (report && report.recentRoutes) || [];
      return { title: "最近路线", rows: routes.map((route) => ({ label: `${route.startName} → ${route.endName}`, value: `${format.fixed(route.distanceKm, 1)} km` })) };
    }
    case "usage-rhythm":
      return { rows: [
        { label: "近 30 天行程", value: value(metrics && metrics.tripCount, (v) => `${v} 次`) },
        { label: "驾驶时长", value: metrics ? `${Math.floor(metrics.drivingMinutes)} 分钟` : "暂无数据" },
        { label: "驾驶距离", value: metrics ? `${format.fixed(metrics.distanceKm, 1)} km` : "暂无数据" }
      ] };
    default:
      return { rows: [] };
  }
}

module.exports = { PERIODS, TEMPLATES, interval, move, periodTitle, detailRows };
