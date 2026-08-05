import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync, readdirSync } from 'fs';
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
    headerBackground?: string;
  };
  dataSource: { type: string; path: string; headers?: Record<string, string> };
  schema: {
    sheets: Record<string, string[]>;
    /** Required at build time — see validateTenantConfig. */
    roles: {
      platforms: string;
      faculty: string;
      facultyPlatforms: string;
      verticals: string;
      facultyVerticals: string;
      collaborations: string;
    };
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
    const available = readdirSync(TENANTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .join(', ');
    throw new Error(
      `Tenant config not found: ${configPath}\n` +
      `Available tenants: ${available || '(none)'}\n` +
      `Run with TENANT=<slug> to build a specific tenant.`
    );
  }
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as TenantConfig;
}

const SCHEMA_ROLES = ['platforms', 'faculty', 'facultyPlatforms', 'verticals', 'facultyVerticals', 'collaborations'] as const;

// Validates a tenant config at build time. Collects every problem and fails
// the build with an actionable message, so a malformed config never produces
// a silently broken bundle.
function validateTenantConfig(config: TenantConfig, slug: string): void {
  const problems: string[] = [];
  const need = (cond: boolean, msg: string) => { if (!cond) problems.push(msg); };

  need(!!config.tenantId, 'tenantId is required');
  if (config.tenantId && config.tenantId !== slug) {
    console.warn(`[tenant] warning: tenantId "${config.tenantId}" does not match folder slug "${slug}".`);
  }
  need(!!config.name, 'name is required');
  need(!!config.description, 'description is required');
  need(!!config.branding?.title, 'branding.title is required');
  need(!!config.branding?.colorAccent, 'branding.colorAccent is required');
  need(!!config.branding?.logo?.src, 'branding.logo.src is required');
  if (config.branding?.logo?.src) {
    // The app deploys with a relative base (base: './') so it can be mounted
    // under any subpath. A leading-slash logo path would resolve against the
    // origin root and break under a subpath mount. It is resolved against
    // import.meta.env.BASE_URL at runtime (see resolveAssetUrl).
    need(!config.branding.logo.src.startsWith('/'),
      'branding.logo.src must be a relative path (no leading "/") — the app deploys with a relative base and mounts under arbitrary subpaths');
  }

  need(config.dataSource?.type === 'local' || config.dataSource?.type === 'remote',
    'dataSource.type must be "local" or "remote"');
  need(!!config.dataSource?.path, 'dataSource.path is required');
  if (config.dataSource?.type === 'local' && config.dataSource?.path) {
    const dataFile = resolve(TENANTS_DIR, slug, 'public', config.dataSource.path.replace(/^\.\//, ''));
    need(existsSync(dataFile), `dataSource.path "${config.dataSource.path}" not found at ${dataFile}`);
  }

  const sheets = config.schema?.sheets ?? {};
  need(Object.keys(sheets).length > 0, 'schema.sheets must define at least one sheet');
  for (const [sheet, cols] of Object.entries(sheets)) {
    need(Array.isArray(cols) && cols.length > 0, `schema.sheets["${sheet}"] must list required columns`);
  }
  // schema.roles is REQUIRED. The runtime engine calls requireSheet() for
  // every role and throws when a mapping is missing, so a config without a
  // complete roles mapping would build into a bundle that deterministically
  // crashes at workbook load. Fail the build instead of warning.
  if (config.schema?.roles) {
    for (const role of SCHEMA_ROLES) {
      const sheetName = config.schema.roles[role];
      need(!!sheetName, `schema.roles.${role} is required`);
      if (sheetName) {
        need(sheetName in sheets, `schema.roles.${role} maps to "${sheetName}", which is not in schema.sheets`);
      }
    }
  } else {
    problems.push('schema.roles is required: map all six roles (platforms, faculty, facultyPlatforms, verticals, facultyVerticals, collaborations) to schema.sheets keys');
  }

  need(!!config.features?.exportFilenameBase, 'features.exportFilenameBase is required');
  need(!!config.coreVersion, 'coreVersion is required');

  // Keep coreVersion honest: warn when the tenant was built against a
  // different core version than package.json declares (see docs/VERSIONING.md).
  const pkgVersion = (JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version?: string }).version;
  if (config.coreVersion && pkgVersion && config.coreVersion !== pkgVersion) {
    console.warn(`[tenant] warning: coreVersion "${config.coreVersion}" differs from package.json version "${pkgVersion}". Update it when rebuilding against a new core.`);
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid tenant config for "${slug}":\n` + problems.map(p => `  - ${p}`).join('\n')
    );
  }
}

const slug = process.env.TENANT || 'cense';
const tenantConfig = loadTenantConfig(slug);
validateTenantConfig(tenantConfig, slug);

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
