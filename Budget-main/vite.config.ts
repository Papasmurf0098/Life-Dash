import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { name: string }

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? packageJson.name
const base =
  process.env.BASE_PATH ?? (process.env.GITHUB_ACTIONS ? `/${repoName}/` : '/')

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pocket Budget',
        short_name: 'Budget',
        description: 'A mobile-first monthly budget app with live totals and recurring bills.',
        theme_color: '#f6f1e8',
        background_color: '#f6f1e8',
        display: 'standalone',
        start_url: '.',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
