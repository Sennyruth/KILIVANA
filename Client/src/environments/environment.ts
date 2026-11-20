import { MAPBOX_ACCESS_TOKEN } from './mapbox-token.generated';

export const environment = {
  production: false,
  // Use the Angular dev-server proxy locally so the browser calls localhost
  // and does not need the backend to allow localhost through CORS.
  apiUrl: '',
  apiOrigin: 'https://kilivana-backend-1jte.onrender.com',
  mapboxAccessToken: MAPBOX_ACCESS_TOKEN,
};
