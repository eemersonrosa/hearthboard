// Always same-origin: Nginx (production) or the Vite dev proxy forwards /api,
// /widgets and /Uploads to the backend, which sends no CORS headers.
// VITE_REACT_APP_API_URL only sets where the Vite dev proxy points.
export const API_BASE_URL = '';
