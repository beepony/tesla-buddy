const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const pad = (value) => String(value).padStart(2, "0");

function toDate(value) {
  if (value instanceof Date) return value;
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fixed(value, digits) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(digits);
}

function withUnit(value, digits, unit) {
  return value === null || value === undefined ? "—" : `${fixed(value, digits)} ${unit}`;
}

function dateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function time(value, seconds = false) {
  const date = toDate(value);
  if (!date) return "—";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}${seconds ? `:${pad(date.getSeconds())}` : ""}`;
}

function monthDay(value) {
  const date = toDate(value);
  return date ? `${date.getMonth() + 1}月${date.getDate()}日` : "—";
}

function dayTitle(value) {
  const date = toDate(value);
  return date ? `${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAYS[date.getDay()]}` : "—";
}

function monthTitle(value, spaced = false) {
  const date = toDate(value);
  return date ? `${date.getFullYear()}年${spaced ? " " : ""}${date.getMonth() + 1}月` : "—";
}

function dateKey(value) {
  const date = toDate(value);
  return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : "";
}

function fromDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function duration(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  const total = Math.max(0, Math.round(minutes));
  if (total >= 60) {
    const hours = Math.floor(total / 60);
    const remainder = total % 60;
    return remainder === 0 ? `${hours}小时` : `${hours}小时${remainder}分`;
  }
  return `${total}分钟`;
}

function parkingDuration(minutes) {
  const total = Math.max(0, Math.floor(minutes));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const rest = total % 60;
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${rest}分钟`;
  return `${rest}分钟`;
}

function relative(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return null;
  const seconds = Math.round((now - date) / 1000);
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 86400 * 2) return "昨天";
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)} 天前`;
  return dateTime(date);
}

function currency(cost) {
  if (!cost) return "—";
  const symbol = { CNY: "¥", USD: "$", EUR: "€" }[cost.currency];
  return symbol ? `${symbol}${fixed(cost.amount, 2)}` : `${fixed(cost.amount, 2)} ${cost.currency}`;
}

function sumCost(items) {
  const costs = items.map((item) => item.cost).filter(Boolean);
  if (costs.length === 0) return null;
  const code = costs[0].currency;
  if (!costs.every((cost) => cost.currency === code)) return null;
  return { amount: costs.reduce((sum, cost) => sum + cost.amount, 0), currency: code };
}

function isSameDay(left, right) {
  return dateKey(left) === dateKey(right);
}

function isSameMonth(value, month) {
  const date = toDate(value);
  return Boolean(date) && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

function addMonths(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

module.exports = {
  fixed, withUnit, dateTime, time, monthDay, dayTitle, monthTitle, dateKey, fromDateKey,
  duration, parkingDuration, relative, currency, sumCost, isSameDay, isSameMonth, addMonths, toDate
};
