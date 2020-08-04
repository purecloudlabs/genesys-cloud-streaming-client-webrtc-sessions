const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = (env) => {
  const minimize = env && env.production;
  return {
    target: 'web',
    entry: './src/index.js',
    devtool: 'source-map',
    mode: minimize ? 'production' : 'development',
    optimization: {
      minimize
    },
    externals: [nodeExternals()],
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: minimize ? 'webrtc-sessions.min.js' : 'webrtc-sessions.js',
      library: 'GenesysCloudStreamingClientWebrtcSessions',
      libraryTarget: 'umd',
      libraryExport: 'default'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          exclude: [/node_modules/],
          query: {
            presets: ['@babel/preset-env']
          }
        }
      ]
    }
  };
};
