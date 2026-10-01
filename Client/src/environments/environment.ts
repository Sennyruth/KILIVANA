// Environment configuration for API integration
// Set NGROK_URL to your ngrok URL when backend is running via ngrok
// Example: export const NGROK_URL = 'https://your-ngrok-url.ngrok-free.app';
export const NGROK_URL = '';

export const environment = {
  production: false,
  ngrokUrl: NGROK_URL,
};