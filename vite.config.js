import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

function injectOAuthCompleteHtml(env) {
  const writeHtml = () => {
    const templatePath = path.resolve('public/oauth-complete.html')
    const outPath = path.resolve('dist/oauth-complete.html')
    const template = fs.readFileSync(templatePath, 'utf8')
    const html = template
      .replaceAll('__VITE_SUPABASE_URL__', env.VITE_SUPABASE_URL || '')
      .replaceAll('__VITE_SUPABASE_ANON_KEY__', env.VITE_SUPABASE_ANON_KEY || '')
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, html)
  }

  return {
    name: 'inject-oauth-complete-html',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/oauth-complete.html')) {
          const template = fs.readFileSync(path.resolve('public/oauth-complete.html'), 'utf8')
          const html = template
            .replaceAll('__VITE_SUPABASE_URL__', env.VITE_SUPABASE_URL || '')
            .replaceAll('__VITE_SUPABASE_ANON_KEY__', env.VITE_SUPABASE_ANON_KEY || '')
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
          return
        }
        next()
      })
    },
    closeBundle: writeHtml,
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), injectOAuthCompleteHtml(env)],
    test: {
      environment: 'node',
      include: ['src/**/*.test.js'],
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
