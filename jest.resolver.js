/**
 * Jest resolver: react-native-worklets ships a native TurboModule that cannot load under Jest.
 * Its own resolver (react-native-worklets/jest/resolver.js) drops the `.native` extensions so
 * the JS fallback is used; we chain that behaviour with the React Native preset's resolver.
 */
const reactNativeResolver = require('@react-native/jest-preset/jest/resolver.js');

module.exports = (request, options) => {
  if (
    options.basedir.includes('react-native-worklets') ||
    request.includes('react-native-worklets')
  ) {
    const extensions = options.extensions?.filter((ext) => !ext.includes('native'));
    return reactNativeResolver(request, { ...options, extensions });
  }
  return reactNativeResolver(request, options);
};
