const format = require("../../utils/format.js");

Component({
  options: { styleIsolation: "apply-shared" },
  properties: { month: { type: Number, value: 0 } },
  data: { title: "" },
  observers: {
    month(value) { this.setData({ title: format.monthTitle(new Date(value || Date.now()), true) }); }
  },
  methods: {
    previous() { this.triggerEvent("change", { offset: -1 }); },
    next() { this.triggerEvent("change", { offset: 1 }); }
  }
});
