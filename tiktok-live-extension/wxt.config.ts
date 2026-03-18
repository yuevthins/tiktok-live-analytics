import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  publicDir: 'public',
  outDir: 'dist', // 输出到可见目录，方便 Chrome 加载
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'TikTok 直播评论采集',
    description: '采集 TikTok 直播间评论和观众数据',
    version: '1.0.0',
    permissions: ['storage', 'alarms'],
    host_permissions: ['ws://localhost:3456/*', 'http://localhost:3456/*'],
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
});
