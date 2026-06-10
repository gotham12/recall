import React from 'react';
import ReactDOM from 'react-dom/client';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import App from './App';
import './index.css';
import { applyGsapDefaults } from './lib/motion';
import { initTheme } from './lib/theme';
import { initSettings } from './lib/settings';
import { preloadFlowers } from './flowers';

gsap.registerPlugin(useGSAP);
applyGsapDefaults();
initSettings();
preloadFlowers(initTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
