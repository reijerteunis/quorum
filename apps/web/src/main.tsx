/**
 * The browser entry point: mount the app into the document `index.html` provides.
 *
 * It refuses rather than defaulting when the mount point is missing, because a silently absent root
 * is a blank page with nothing said about why.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.js';

const root = document.getElementById('root');
if (root === null) throw new Error('index.html declares no #root element to mount into');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
