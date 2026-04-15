import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'

const adapter = process.env.CF_PAGES
  ? cloudflare({ platformProxy: { enabled: false } })
  : node({ mode: 'standalone' })

export default defineConfig({
  output: 'server',
  adapter,
  vite: {
    plugins: [tailwindcss()]
  }
})
