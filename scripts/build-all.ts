// Builds every tenant found under tenants/ (any folder containing a
// tenant.config.json), sequentially, into dist/{slug}/.
//
// Usage:
//   bun run build:all
//
// Onboarding a new tenant requires no changes to package.json — this script
// discovers tenants automatically.

import { readdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

const tenantsDir = resolve(import.meta.dir, '../tenants');

const slugs = readdirSync(tenantsDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(resolve(tenantsDir, d.name, 'tenant.config.json')))
  .map(d => d.name)
  .sort();

if (slugs.length === 0) {
  console.error(`No tenants found under ${tenantsDir}`);
  process.exit(1);
}

console.log(`Building ${slugs.length} tenant(s): ${slugs.join(', ')}`);

for (const slug of slugs) {
  console.log(`\n=== Building tenant: ${slug} ===`);
  const res = spawnSync('bun', ['run', 'build'], {
    stdio: 'inherit',
    env: { ...process.env, TENANT: slug },
  });
  if (res.status !== 0) {
    console.error(`\nBuild failed for tenant "${slug}" (exit ${res.status}).`);
    process.exit(res.status ?? 1);
  }
}

console.log('\nAll tenants built successfully.');
