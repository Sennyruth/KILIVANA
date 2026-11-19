module.exports = {
  '/api': {
    target: 'https://kilivana-backend.onrender.com',
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin');
      });
    },
  },
};
