import { AppRegistry } from 'react-native';
import App from '../App';
import './fonts.css';

// react-native-web entry point. AppRegistry.runApplication mounts the app and
// lets RNW inject its style sheet in the right order.
AppRegistry.registerComponent('ReelSpark', () => App);
AppRegistry.runApplication('ReelSpark', {
  rootTag: document.getElementById('root'),
});
