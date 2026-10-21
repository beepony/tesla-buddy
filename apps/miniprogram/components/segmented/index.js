Component({
  options: { styleIsolation: "apply-shared" },
  properties: {
    items: { type: Array, value: [] },
    value: { type: String, value: "" }
  },
  methods: {
    select(event) {
      const { value } = event.currentTarget.dataset;
      if (value !== this.data.value) this.triggerEvent("change", { value });
    }
  }
});
