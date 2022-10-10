const path = require('path');
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = {
  entry: './src/index.ts',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'json-schema-xsd-tools.js',
    globalObject: 'this',
    library: {
      name: 'json-schema-xsd-tools',
      type: 'umd',
    },
  },
  mode: 'production',
  plugins: [new ESLintPlugin()]
};