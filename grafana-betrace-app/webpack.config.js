const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = {
  target: 'web',
  entry: {
    module: './src/module.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
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
    '@grafana/ui',
    '@grafana/runtime',
    '@grafana/data',
    'react',
    'react-dom',
    'react-router-dom',
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
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
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        type: 'asset/resource',
      },
      {
        test: /\.ttf$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile: path.resolve(__dirname, 'tsconfig.json'),
        configOverwrite: {
          exclude: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
        },
      },
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/plugin.json', to: '.' },
        { from: 'src/img', to: 'img', noErrorOnMissing: true },
        { from: 'README.md', to: '.', noErrorOnMissing: true },
        { from: 'LICENSE', to: '.', noErrorOnMissing: true },
      ],
    }),
    new MonacoWebpackPlugin({
      languages: ['typescript', 'javascript'],
      features: [
        'coreCommands',
        'find',
        'bracketMatching',
        'suggest',
        'hover',
        'snippets',
        'format',
        'folding',
        'links',
      ],
    }),
  ],
  optimization: {
    minimize: true,
  },
};
