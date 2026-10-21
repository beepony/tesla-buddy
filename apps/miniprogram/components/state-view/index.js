Component({
  options: { styleIsolation: "apply-shared" },
  properties: {
    loading: { type: Boolean, value: false },
    title: { type: String, value: "" },
    message: { type: String, value: "" },
    retry: { type: Boolean, value: true }
  },
  methods: { onRetry() { this.triggerEvent("retry"); } }
});
