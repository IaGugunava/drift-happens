// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    apiBaseInternal:
      process.env.NUXT_API_BASE_INTERNAL ??
      process.env.NUXT_PUBLIC_API_BASE ??
      'http://localhost:8080',
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:8080',
      socketBase: process.env.NUXT_PUBLIC_SOCKET_BASE ?? 'http://localhost:8080',
    },
  },
})
