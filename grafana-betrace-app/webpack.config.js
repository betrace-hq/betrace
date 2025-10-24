const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
  target: 'web',
  entry: './src/module.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'module.js',
    libraryTarget: 'amd',
    clean: true,
  },
  externals: [
    'lodash',
    'jquery',
    'moment',
    'slate',
    'emotion',
    'prismjs',
    '@grafana/slate-react',
    '@grafana/data',
    '@grafana/runtime',
    '@grafana/ui',
    'react',
    'react-dom',
    'react-router-dom',
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              target: 'es2015',
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
            },
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  plugins: [
    new MonacoWebpackPlugin({
      languages: ['javascript', 'typescript'],
      features: ['!gotoSymbol'],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/plugin.json', to: 'plugin.json' },
        { from: 'README.md', to: 'README.md' },
      ],
    }),
    new ForkTsCheckerWebpackPlugin({
      async: true,
      typescript: {
        configFile: path.resolve(__dirname, 'tsconfig.json'),
      },
    }),
  ],
  devtool: 'source-map',
  optimization: {
    minimize: false,
    splitChunks: false, // Disable code splitting - bundle everything into module.js
  },
};
