const path = require("path");

module.exports = {
  entry: "./src/index.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
    library: { type: "umd", name: "XpMeterImproved" },
    publicPath: "",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    fallback: {
      "canvas": false,
      "electron": false,
      "electron/common": false,
      "fs": false,
      "child_process": false,
      "crypto": false,
      "events": false,
      "os": false,
      "path": false,
      "stream": false,
      "util": false,
      "node:child_process": false,
      "node:crypto": false,
      "node:events": false,
      "node:os": false,
      "node:path": false,
      "node:stream": false,
      "node:util": false,
      "sharp": false,
    },
  },
  externals: {
    sharp: "commonjs sharp",
  },
  ignoreWarnings: [
    { module: /sharp/ },
    { module: /canvas/ },
  ],
  module: {
    rules: [
      { test: /\.tsx?$/, use: "ts-loader", exclude: /node_modules/ },
      { test: /\.html$/, type: "asset/resource", generator: { filename: "[name][ext]" } },
      { test: /\.json$/, type: "asset/resource", generator: { filename: "[name][ext]" } },
      { test: /\.css$/, type: "asset/resource", generator: { filename: "[name][ext]" } },
      { test: /\.data\.png$/, loader: "alt1/imagedata-loader" },
      { test: /\.png$/, exclude: /\.data\.png$/, type: "asset/resource", generator: { filename: "[name][ext]" } },
    ],
  },
  devServer: {
    static: path.resolve(__dirname, "dist"),
    compress: true,
    port: 8080,
  },
};
