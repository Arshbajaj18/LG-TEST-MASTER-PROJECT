import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Hosts the dev/preview server answers to. The leading dot also covers
// sibling subdomains, so a renamed deployment keeps working.
const allowedHosts = ['.iocompute.ai']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build can be hosted under any sub-path on the LG on-prem server.
  base: './',
  server: {
    port: 8430,
    strictPort: true,
    host: true,
    allowedHosts,
  },
  preview: {
    port: 8430,
    strictPort: true,
    host: true,
    allowedHosts,
  },
})
