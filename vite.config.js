import { defineConfig } from 'vite';

// 第三方聚合接口不带 CORS 头，浏览器直连会被拦。开发/预览期由 Vite 代理转发，
// 生产环境用 Nginx 等把 /gdapi 反向代理到同一个上游即可（或在 .env 里用 VITE_API_BASE 指到自己的网关）。
const API_ORIGIN = process.env.SONORA_API_ORIGIN || 'https://music-api.gdstudio.xyz';

const proxy = {
  '/gdapi': {
    target: API_ORIGIN,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/gdapi/, ''),
  },
};

export default defineConfig({
  server: { proxy },
  preview: { proxy },
});
