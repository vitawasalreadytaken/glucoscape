const path = require("path")

module.exports = {
  mode: "development",
  devtool: "source-map",
  entry: {
    app: ["./src/app.ts"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings
          "style-loader",
          // Translates CSS into CommonJS
          "css-loader",
          // Compiles Sass to CSS
          "sass-loader",
        ],
      },
    ],
  },
  resolve: {
    extensions: [
      ".ts",
      ".tsx",
      // '.js' // Needed for 3rd-party libraries written in pure JS
    ],
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "build"),
  },
}
