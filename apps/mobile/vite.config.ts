import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const shim = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// The mobile app runs in the browser via react-native-web. `react-native` is
// aliased to `react-native-web`, and the handful of Expo modules it used are
// swapped for small local web shims in src/shims.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // assets/ holds icons/splash art; expose it as the public dir so favicon.png
  // is served at /favicon.png.
  publicDir: 'assets',
  server: { port: 5174 },
  resolve: {
    // `.web.*` wins so library web builds (react-native-svg, etc.) load.
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.mjs',
      '.json',
    ],
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      // react-native-svg statically imports Node's `buffer` (only used for
      // remote-URI SVGs, which this app doesn't use) — point it at the polyfill.
      { find: /^buffer$/, replacement: 'buffer/' },
      { find: 'expo-linear-gradient', replacement: shim('./src/shims/expo-linear-gradient.tsx') },
      { find: 'expo-image-picker', replacement: shim('./src/shims/expo-image-picker.ts') },
      { find: '@expo/vector-icons', replacement: shim('./src/shims/vector-icons.tsx') },
    ],
  },
  define: {
    global: 'globalThis',
    __DEV__: JSON.stringify(mode !== 'production'),
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: ['.web.js', '.web.ts', '.web.tsx', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.json'],
      loader: { '.js': 'jsx' },
    },
  },
}))
