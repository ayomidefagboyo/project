import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Strip the `crossorigin` attribute from script/link tags in the built HTML.
 * Electron loads the app via file:// protocol, and `crossorigin` causes
 * CORS errors on local files → white screen.
 */
function removeCrossorigin(): Plugin {
  return {
    name: 'remove-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), removeCrossorigin()],
  // Use relative paths so the built app works in Electron's file:// protocol
  // as well as normal HTTP serving (Vercel, dev server, etc.)
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    modulePreload: { polyfill: false },
  },
  server: {
    port: 5174,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
  },
})
