const path = require('path');

module.exports = (env) => {
  const minimize = env && env.production;
  return {
    entry: './src/index.js',
    mode: minimize ? 'production' : 'development',
    optimization: {
      minimize
    },
    devtool: 'source-map',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: minimize ? 'webrtc-sessions.min.js' : 'webrtc-sessions.js',
      library: 'pc-streaming',
      libraryTarget: 'umd'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          query: {
            presets: ['env']
          }
        }
      ]
    }
  };
};
