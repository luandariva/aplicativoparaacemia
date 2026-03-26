import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveEffectiveFunctionsUrlFromEnv } from './src/portal/supabaseFunctionsUrl'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Em dev: `/supabase-api` → projeto (Auth + REST + ws); `/supabase-functions` → Edge Functions.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')

  const proxy: Record<string, object> = {}

  const projectUrl = env.VITE_SUPABASE_URL?.trim()
  if (projectUrl?.startsWith('http://') || projectUrl?.startsWith('https://')) {
    try {
      const apiOrigin = new URL(projectUrl).origin
      proxy['/supabase-api'] = {
        target: apiOrigin,
        changeOrigin: true,
        secure: true,
        ws: true,
        rewrite: (p: string) => {
          const stripped = p.replace(/^\/supabase-api/, '')
          return stripped === '' ? '/' : stripped
        },
      }
    } catch {
      /* URL inválida */
    }
  }

  try {
    const base = resolveEffectiveFunctionsUrlFromEnv(env)
    const origin = new URL(base).origin
    proxy['/supabase-functions'] = {
      target: origin,
      changeOrigin: true,
      secure: true,
      rewrite: (p: string) => {
        const stripped = p.replace(/^\/supabase-functions/, '')
        return stripped === '' ? '/' : stripped
      },
    }
  } catch {
    /* .env incompleto para functions */
  }

  return {
    plugins: [react()],
    server: { proxy: Object.keys(proxy).length ? proxy : undefined },
  }
})
