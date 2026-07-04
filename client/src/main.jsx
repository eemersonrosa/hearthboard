import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { initTimezone } from './utils/timezone.js';

const App = lazy(() => import('./app.jsx'));
const PhotosUpload = lazy(() => import('./pages/PhotosUpload.jsx'));

const renderRoute = () => {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/photos' || path.startsWith('/photos/')) {
    return <PhotosUpload />;
  }
  return <App />;
};

// Demo mode (VITE_DEMO_MODE=1): intercept the entire /api surface in-browser
// with sample data so the app runs backend-less (e.g. on GitHub Pages). The
// worker must be running before initTimezone() fires the first request.
const startDemoWorker = async () => {
  if (import.meta.env.VITE_DEMO_MODE !== '1') return;
  const { worker } = await import('./demo/browser.js');
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
  });
};

startDemoWorker()
  .catch((error) => console.error('Demo mode failed to start:', error))
  .then(() => initTimezone())
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
          {renderRoute()}
        </Suspense>
      </React.StrictMode>
    );
  });
