// The app's entry point. Mounts <App> into the page's #root element under
// StrictMode, and pulls in the global stylesheet.
import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';

import { App } from './app';
import './app.css';

const root = document.getElementById('root');

if (root === null) {
  throw new Error('index.html has no #root element.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
