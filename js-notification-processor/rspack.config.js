const path = require('path');

module.exports = {
  mode: 'production',          // minifies and tree-shakes
  entry: './src/index.ts',
  output: {
    filename: 'wallet-bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      name: 'WalletBundle',    // Swift will access global.WalletBundle.run
      type: 'umd'
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'typescript' },
              target: 'es2020',
              externalHelpers: true
            }
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  target: ['web']              // guarantees a browser-safe build
};
