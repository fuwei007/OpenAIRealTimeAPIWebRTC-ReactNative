/**
 * @format
 */

import {AppRegistry,LogBox} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

LogBox.ignoreAllLogs();

global.ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('Global Error Caught:', error, 'isFatal:', isFatal);
});

const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0] && args[0].includes('Possible Unhandled Promise Rejection')) {
    console.log('Unhandled Promise Rejection:', args);
  } else {
    originalConsoleError(...args);
  }
};

AppRegistry.registerComponent(appName, () => App);
