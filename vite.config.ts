import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const root = resolve(import.meta.dirname, 'src');
const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'));

/** In dev only, allow Vite's HMR websocket through the otherwise strict CSP. */
function devCsp(port: number): Plugin {
  return {
    name: 'dmarc-shield-dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        /(http-equiv="Content-Security-Policy"\s+content="[^"]*?connect-src )([^;"]*)/,
        `$1$2 wss://localhost:${port}`,
      );
    },
  };
}

export default defineConfig(async ({ command }) => {
  const port = 3000;
  let https: import('node:https').ServerOptions | undefined;
  if (command === 'serve' && !process.env.NO_HTTPS) {
    // Reuse certificates from `npx office-addin-dev-certs install`. Reading them
    // directly avoids the helper's sudo-based CA re-install check on Linux.
    const dir = resolve(homedir(), '.office-addin-dev-certs');
    if (existsSync(resolve(dir, 'localhost.crt'))) {
      https = {
        cert: readFileSync(resolve(dir, 'localhost.crt')),
        key: readFileSync(resolve(dir, 'localhost.key')),
        ca: readFileSync(resolve(dir, 'ca.crt')),
      };
    } else {
      const devCerts = await import('office-addin-dev-certs');
      https = await devCerts.getHttpsServerOptions();
    }
  }
  return {
    root,
    base: './',
    publicDir: resolve(import.meta.dirname, 'public'),
    plugins: [devCsp(port)],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    build: {
      outDir: resolve(import.meta.dirname, 'dist'),
      emptyOutDir: true,
      target: 'es2022',
      sourcemap: false,
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: {
          taskpane: resolve(root, 'taskpane.html'),
          commands: resolve(root, 'commands.html'),
        },
      },
    },
    server: { port, strictPort: true, https },
    preview: { port, strictPort: true },
  };
});
