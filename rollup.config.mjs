import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

/** @type {import("rollup").RollupOptions} */
const config = {
  input: "src/plugin.ts",
  output: {
    file: "com.juhani.blackmagic-camera.sdPlugin/bin/plugin.js",
    sourcemap: false,
    format: "cjs",
  },
  // Node.js built-in modules — provided by the Stream Deck embedded Node.js runtime
  external: [
    "assert", "buffer", "child_process", "crypto", "dns", "events",
    "fs", "http", "https", "net", "os", "path", "process", "readline",
    "stream", "string_decoder", "timers", "tls", "url", "util", "zlib",
  ],
  plugins: [
    nodeResolve({ browser: false, preferBuiltins: true }),
    commonjs(),
    typescript(),
  ],
};

export default config;
