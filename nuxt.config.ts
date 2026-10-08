import { defineNuxtConfig } from 'nuxt/config'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  telemetry: false,
  experimental: {
    asyncContext: true,
  },
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_KEY || '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
  },
  hooks: {
    'pages:extend'(pages) {
      // In production builds, remove the local synthetic demo page so it is never exposed in production artifacts
      if (process.env.NODE_ENV === 'production') {
        const demoIndex = pages.findIndex(
          (p) => p.path === '/demo' || p.name === 'demo' || (typeof p.file === 'string' && p.file.endsWith('/demo.vue'))
        )
        if (demoIndex !== -1) {
          pages.splice(demoIndex, 1)
        }
      }
    },
  },
})
