import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The engines and the room API are covered by `node --test` against `test/`. This config
// covers the web client only, and its tests sit beside the code they exercise in `src/`.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/vitest-setup.ts"],
    restoreMocks: true
  }
});
