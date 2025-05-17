import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: { environment: "node", include: ["src/**/*.test.ts"], globals: true },
    resolve: { alias: { utils: path.resolve(__dirname, "./src/utils") } },
});
