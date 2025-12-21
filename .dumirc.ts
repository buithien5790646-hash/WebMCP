import { defineConfig } from 'dumi';

export default defineConfig({
  themeConfig: {
    name: 'WebMCP',
    nav: [
      { title: '指南', link: '/guide' },
      { title: '开发', link: '/guide/development' },
      { title: '架构', link: '/guide/architecture' },
    ],
  },
  outputPath: 'docs-dist',
  resolve: {
    docDirs: ['docs'],
  },
});
