const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const { getDefinePluginConfig } = require('./edition.config');

/**
 * Webpack config for AIDA extension.
 * Single build — activation key is always required.
 */
module.exports = (env = {}) => {
  console.log(`\n🏷️  Building AIDA extension\n`);

  return {
    target: 'node',
    mode: 'none',

    entry: './extension.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2'
    },
    externals: {
      vscode: 'commonjs vscode',
      'webworker-threads': 'commonjs webworker-threads',
      'worker_threads': 'commonjs worker_threads'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    plugins: [
      new webpack.DefinePlugin(getDefinePluginConfig()),
      new CopyPlugin({
        patterns: [
          {
            from: 'scripts/chatbot/templates/**/*',
            to: 'scripts/chatbot/templates/[name][ext]',
            noErrorOnMissing: true
          },
          {
            from: 'scripts/review/templates/**/*',
            to: 'scripts/review/templates/[name][ext]',
            noErrorOnMissing: true
          },
          {
            from: 'scripts/dependency/templates/**/*',
            to: 'scripts/dependency/templates/[name][ext]',
            noErrorOnMissing: true
          },
          {
            from: 'scripts/dependency/views/**/*',
            to: 'scripts/dependency/views/[name][ext]',
            noErrorOnMissing: true
          },
          {
            from: '**/*',
            to: 'monaco-editor/min/',
            context: 'node_modules/monaco-editor/min/',
            noErrorOnMissing: true
          }
        ],
      }),
    ],
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [{ loader: 'ts-loader' }]
        },
        {
          test: /\.html$/,
          type: 'asset/resource'
        }
      ]
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: {
      level: 'log',
    },
  };
};