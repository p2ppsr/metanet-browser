const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Add crypto polyfill configuration
config.resolver.extraNodeModules = {
  crypto: require.resolve('react-native-quick-crypto'),
  buffer: require.resolve('buffer'),
  stream: require.resolve('stream-browserify'),
  ...config.resolver.extraNodeModules
}

module.exports = config
