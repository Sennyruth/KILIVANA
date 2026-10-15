module.exports = {
  '/api': {
    target: 'https://either-juvenile-progeny.ngrok-free.dev',
    changeOrigin: true,
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin');
      });
    },
  },
};
