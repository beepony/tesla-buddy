const format = require("../../utils/format.js");

Component({
  options: { styleIsolation: "apply-shared" },
  properties: {
    month: { type: Number, value: 0 },
    counts: { type: Object, value: {} }
  },
  data: { weekdays: ["一", "二", "三", "四", "五", "六", "日"], cells: [] },
  observers: {
    "month, counts"(month, counts) {
      const first = new Date(month || Date.now());
      first.setDate(1);
      const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      // Weeks start on Monday, matching the iOS calendar.
      const leading = (first.getDay() + 6) % 7;
      const today = format.dateKey(new Date());
      const cells = [];
      for (let i = 0; i < leading; i += 1) cells.push({ key: `lead-${i}`, empty: true });
      for (let day = 1; day <= days; day += 1) {
        const key = format.dateKey(new Date(first.getFullYear(), first.getMonth(), day));
        cells.push({ key, day, count: (counts || {})[key] || 0, today: key === today });
      }
      while (cells.length % 7 !== 0) cells.push({ key: `trail-${cells.length}`, empty: true });
      this.setData({ cells });
    }
  },
  methods: {
    select(event) {
      const { key } = event.currentTarget.dataset;
      if (key) this.triggerEvent("select", { date: key });
    }
  }
});
