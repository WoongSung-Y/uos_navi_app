// ✅ 올바른 index.js
import { AppRegistry } from 'react-native';
import App from './App'; // 프로젝트 루트의 App.tsx
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
