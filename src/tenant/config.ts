// Tenant configuration module.
//
// The tenant config is injected at build time via Vite's define plugin.
// The build step reads tenants/{slug}/tenant.config.json and inlines it as
// a global `__TENANT_CONFIG__` constant. This module provides a typed accessor
// so the rest of the codebase can consume it without knowing the injection
// mechanism.
//
// The config is read-only at runtime — no fetch, no network call. Each tenant
// gets its own bundle with its own inlined config.
//
// This module contains ZERO tenant-specific strings. The fallback config below
// uses generic placeholder values so the core engine code never references
// any specific client's branding, data source, or schema.

export interface TenantLogo {
  src: string;
  alt: string;
}

export interface TenantBranding {
  logo: TenantLogo;
  title: string;
  colorAccent: string;
  /** Header background color. Defaults to a neutral light grey. */
  headerBackground?: string;
}

export interface TenantDataSource {
  type: 'local' | 'remote';
  path: string;
  /** Optional HTTP headers for remote data sources (e.g. API keys). */
  headers?: Record<string, string>;
}

export interface EntityTypeConfig {
  label: string;
  searchable: boolean;
}

export interface EdgeTypeConfig {
  label: string;
}

export interface TenantSchema {
  /** Map of sheet name → required column names. */
  sheets: Record<string, string[]>;
  entityTypes: Record<string, EntityTypeConfig>;
  edgeTypes: Record<string, EdgeTypeConfig>;
}

export interface TenantFeatures {
  defaultShowPlatforms: boolean;
  defaultShowVerticals: boolean;
  defaultShowCollaborations: boolean;
  defaultShowRelationships: boolean;
  exportFilenameBase: string;
}

export interface TenantConfig {
  tenantId: string;
  name: string;
  description: string;
  branding: TenantBranding;
  dataSource: TenantDataSource;
  schema: TenantSchema;
  features: TenantFeatures;
  coreVersion: string;
}

// The build-time injected config. Vite replaces `__TENANT_CONFIG__` with the
// JSON-parsed tenant config object. If the global is not defined (e.g. running
// in a non-Vite context), we fall back to a generic config so the app still
// works for development/testing without crashing.
declare const __TENANT_CONFIG__: TenantConfig;

function getInjectedConfig(): TenantConfig | null {
  try {
    if (typeof __TENANT_CONFIG__ !== 'undefined') {
      return __TENANT_CONFIG__;
    }
  } catch {
    // __TENANT_CONFIG__ is not defined — fall through to fallback.
  }
  return null;
}

// Generic fallback config — no tenant-specific strings. Used only when the
// build-time injection is not available (e.g. running outside Vite, or in
// tests). In production builds, this is never used because Vite always
// injects the tenant config.
const FALLBACK_CONFIG: TenantConfig = {
  tenantId: 'default',
  name: 'Network Relationship Explorer',
  description: 'An accessible visualization of organizational networks as interactive graphs.',
  branding: {
    logo: { src: '', alt: '' },
    title: 'NETWORK EXPLORER',
    colorAccent: '#0066cc',
    headerBackground: '#dedddd'
  },
  dataSource: {
    type: 'local',
    path: './data/dataset.xlsx'
  },
  schema: {
    sheets: {},
    entityTypes: {},
    edgeTypes: {}
  },
  features: {
    defaultShowPlatforms: true,
    defaultShowVerticals: true,
    defaultShowCollaborations: true,
    defaultShowRelationships: true,
    exportFilenameBase: 'network'
  },
  coreVersion: '1.0.0'
};

const config = getInjectedConfig() ?? FALLBACK_CONFIG;

export function getTenantConfig(): TenantConfig {
  return config;
}

export const tenantConfig = config;
