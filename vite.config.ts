import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Tenant-aware build configuration.
//
// The build step reads tenants/{slug}/tenant.config.json and injects it as a
// global `__TENANT_CONFIG__` constant via Vite's `define` option. This means
// each tenant's bundle has its own config inlined at build time — no runtime
// fetch, no runtime branching on tenant identity.
//
// Usage:
//   TENANT=cense bun run build     # builds the cense tenant
//   TENANT=test-dept bun run build # builds the test-dept tenant
//   bun run build                   # defaults to cense

const TENANTS_DIR = resolve(__dirname, 'tenants');

interface TenantConfig {
  tenantId: string;
  name: string;
  description: string;
  branding: {
    logo: { src: string; alt: string };
    title: string;
    colorAccent: string;
  };
  dataSource: { type: string; path: string; headers?: Record<string, string> };
  schema: {
    sheets: Record<string, string[]>;
    entityTypes: Record<string, { label: string; searchable: boolean }>;
    edgeTypes: Record<string, { label: string }>;
  };
  features: {
    defaultShowPlatforms: boolean;
    defaultShowVerticals: boolean;
    defaultShowCollaborations: boolean;
    defaultShowRelationships: boolean;
    exportFilenameBase: string;
  };
  coreVersion: string;
}

function loadTenantConfig(slug: string): TenantConfig {
  const configPath = resolve(TENANTS_DIR, slug, 'tenant.config.json');
  if (!existsSync(configPath)) {
    throw new Error(
      `Tenant config not found: ${configPath}\n` +
      `Available tenants: cense, test-dept\n` +
      `Run with TENANT=<slug> to build a specific tenant.`
    );
  }
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as TenantConfig;
}

const slug = process.env.TENANT || 'cense';
const tenantConfig = loadTenantConfig(slug);

// Per-tenant static assets. Each tenant's dist/ must contain ONLY that
// tenant's data and branding — never another tenant's workbook. If the
// tenant has its own public/ dir, it becomes the Vite publicDir; otherwise
// we fall back to the repo-root public/ (shared assets only).
const tenantPublicDir = resolve(TENANTS_DIR, slug, 'public');
const publicDir = existsSync(tenantPublicDir) ? tenantPublicDir : resolve(__dirname, 'public');

// Vite plugin: inject the tenant config as a global constant and transform
// index.html to use tenant-specific metadata (title, description).
function tenantPlugin(): PluginOption {
  return {
    name: 'vite-plugin-tenant',
    transformIndexHtml(html) {
      let result = html;
      // Replace title
      result = result.replace(
        /<title>.*?<\/title>/s,
        `<title>${tenantConfig.name}</title>`
      );
      // Replace meta description
      result = result.replace(
        /<meta name="description" content=".*?" \/>/,
        `<meta name="description" content="${tenantConfig.description}" />`
      );
      return result;
    },
  };
}

// Intranet deployment. Use relative base so the app works under any mount path.
// Data file lives in the tenant's public dir (tenants/{slug}/public/data) and
// is fetched at runtime.
export default defineConfig({
  plugins: [react(), tenantPlugin()],
  base: './',
  publicDir,
  define: {
    '__TENANT_CONFIG__': JSON.stringify(tenantConfig),
    '__TENANT_SLUG__': JSON.stringify(slug),
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    // When testing via docker host, allow the docker bridge hostname too.
    allowedHosts: ['host.docker.internal', 'localhost', '127.0.0.1']
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
    allowedHosts: ['host.docker.internal', 'localhost', '127.0.0.1']
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    outDir: `dist/${slug}`,
  },
});
