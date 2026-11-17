import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // .env 파일에서 환경변수 로드 (접두사 없이 모두 읽음)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      {
        // index.html의 <!-- ENV_INJECT --> 주석을 Supabase 설정 인라인 스크립트로 치환
        name: 'inject-env',
        transformIndexHtml(html) {
          return html.replace(
            '<!-- ENV_INJECT -->',
            `<script>
  window.SUPABASE_URL = ${JSON.stringify(env.SUPABASE_URL || '')};
  window.SUPABASE_KEY = ${JSON.stringify(env.SUPABASE_KEY || '')};
</script>`
          )
        },
      },
    ],
    server: {
      port: 3000,
      open: true,
    },
    build: {
      outDir: 'dist',
    },
  }
})
