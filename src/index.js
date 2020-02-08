import React from 'react';
import ReactDOM from 'react-dom';
import { initializeIcons } from '@uifabric/icons';

import App from './components/App';

import './index.css';

// need to setup the Fabric icon package: https://developer.microsoft.com/en-us/fabric#/styles/web/icons#fabric-react
initializeIcons();

// render our app here
ReactDOM.render(<App />, document.getElementById('root'));
