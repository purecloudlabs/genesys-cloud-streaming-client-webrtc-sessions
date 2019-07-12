const path = require('path');

module.exports = (env) => {
  const minimize = env && env.production;
  return {
    target: 'node',
    entry: './src/index.js',
    devtool: 'source-map',
    mode: minimize ? 'production' : 'development',
    optimization: {
      minimize
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: minimize ? 'webrtc-sessions.min.js' : 'webrtc-sessions.js',
      library: 'PureCloudStreamingClientWebrtcSessions',
      libraryTarget: 'umd',
      libraryExport: 'default'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          query: {
            presets: ['@babel/preset-env']
          }
        }
      ]
    }
  };
};
