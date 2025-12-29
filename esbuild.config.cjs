const { build } = require("esbuild");
const esbuildPluginPino = require("esbuild-plugin-pino");
build({
    entryPoints: [{ in: "src/index.ts", out: "main.min" }],
    bundle: true,
    platform: "node",
    target: "node18",
    format: "cjs",
    sourcemap: true,
    minify: true,
    treeShaking: true,
    outdir: "build",
    plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })]
});