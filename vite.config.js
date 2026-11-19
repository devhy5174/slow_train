import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // .env 파일에서 환경변수 로드 (접두사 없이 모두 읽음)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // GitHub Actions 빌드일 때만 /slow_train/ 로 base 설정 (Netlify는 /)
    base: process.env.GITHUB_ACTIONS ? '/slow_train/' : '/',
    plugins: [
      {
        // index.html의 <!-- ENV_INJECT --> 주석을 Supabase 설정 인라인 스크립트로 치환
        name: 'inject-env',
        transformIndexHtml(html) {
          // loadEnv는 .env 파일만 읽으므로, Netlify process.env도 fallback으로 사용
          const url = env.SUPABASE_URL || process.env.SUPABASE_URL || '';
          const key = env.SUPABASE_KEY || process.env.SUPABASE_KEY || '';
          return html.replace(
            '<!-- ENV_INJECT -->',
            `<script>
  window.SUPABASE_URL = ${JSON.stringify(url)};
  window.SUPABASE_KEY = ${JSON.stringify(key)};
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
