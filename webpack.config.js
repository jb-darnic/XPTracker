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
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: "ts-loader", exclude: /node_modules/ },
      { test: /\.html$/, type: "asset/resource", generator: { filename: "[name][ext]" } },
      { test: /\.json$/, type: "asset/resource", generator: { filename: "[name][ext]" } },
      { test: /\.css$/, type: "asset/resource", generator: { filename: "[name][ext]" } },
      { test: /\.png$/, type: "asset/resource", generator: { filename: "[name][ext]" } },
      { test: /\.data\.png$/, loader: "alt1/imagedata-loader" },
    ],
  },
  devServer: {
    static: path.resolve(__dirname, "dist"),
    compress: true,
    port: 8080,
  },
};
