/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Existe um pnpm-lock.yaml em C:\Users\dhuda que faz o Next escolher a pasta
  // do usuario como raiz do workspace. Fixa a raiz nesta pasta.
  outputFileTracingRoot: import.meta.dirname,
};
