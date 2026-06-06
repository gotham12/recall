import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const base = import.meta.env.BASE_URL;
document.documentElement.style.setProperty('--leaf-bl', `url(${base}leaf_bl.png)`);
document.documentElement.style.setProperty('--leaf-tr', `url(${base}leaf_tr.png)`);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
