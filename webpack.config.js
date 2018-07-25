'use strict';

const path = require('path');

module.exports = {
  target: 'node',
  entry: './src/index.js',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'firehose-webrtc-sessions.js',
    library: 'firehose-webrtc-sessions',
    libraryTarget: 'umd'
  },
  optimization: {
    minimize: false
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015']
        }
      }
    ]
  }
};
