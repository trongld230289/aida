const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const { getDefinePluginConfig } = require('./edition.config');

/**
 * Webpack config as function to receive --env flag.
 * Usage:
 *   webpack --env edition=public   → Public edition (no tracking)
 *   webpack --env edition=company  → Company edition (tracking enabled)
 *   webpack                        → Defaults to company edition
 */
module.exports = (env = {}) => {
  const edition = env.edition || 'company';
  console.log(`\n🏷️  Building AIDA extension — Edition: ${edition.toUpperCase()}\n`);

  return {
    target: 'node',
    mode: 'none',

    entry: './extension.js',
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
      new webpack.DefinePlugin(getDefinePluginConfig(edition)),
      new CopyPlugin({
        patterns: [
          {
            from: 'scripts/chatbot/templates/**/*',
            to: 'scripts/chatbot/templates/[name][ext]',
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