module.exports = {
  '/api': {
    target: 'https://hankering-morphing-outclass.ngrok-free.dev',
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
