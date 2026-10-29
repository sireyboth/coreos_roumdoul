// Metro (the bundler) runs src/global.css through Tailwind for NativeWind.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './src/global.css', inlineRem: 16 });
