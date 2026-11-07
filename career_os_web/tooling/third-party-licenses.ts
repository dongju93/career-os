import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite-plus';
import { z } from 'zod/v4';

export const licenseMetadataFile = '.vite/license-metadata.json';
export const thirdPartyNoticesFile = 'THIRD_PARTY_NOTICES.txt';

const packageSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
});
const licenseEntriesSchema = z
  .array(packageSchema.extend({ identifier: z.string().trim().min(1) }))
  .nonempty();
type InstalledPackage = z.infer<typeof packageSchema> & { directory: string };
type NoticeFile = { name: string; text: string; kind: 'license' | 'notice' };

// These published packages omit LICENSE; each fallback is reviewed for one version.
const licenseFallbacks = new Map([
  ['@stylexjs/stylex@0.19.1', 'stylex-0.19.1-LICENSE'],
  ['react-remove-scroll-bar@2.3.8', 'react-remove-scroll-bar-2.3.8-LICENSE'],
]);

function findPackage(moduleId: string): InstalledPackage | undefined {
  let directory = dirname(moduleId.split('?')[0]);
  while (directory.includes('node_modules')) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      const pkg = packageSchema.safeParse(
        JSON.parse(readFileSync(manifest, 'utf8')),
      );
      if (pkg.success) return { ...pkg.data, directory };
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
}

function readNoticeFiles(directory: string, prefix = ''): NoticeFile[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) => prefix || /^(licen[sc]e|copying|notice)/i.test(entry.name),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const file = join(directory, entry.name);
      const name = join(prefix, entry.name);
      if (entry.isDirectory()) return readNoticeFiles(file, name);
      if (!entry.isFile()) return [];
      const text = readFileSync(file, 'utf8').trim();
      if (!text) throw new Error(`Empty third-party notice: ${file}`);
      return [
        {
          name,
          text,
          kind: /^(licen[sc]e|copying)/i.test(name) ? 'license' : 'notice',
        } satisfies NoticeFile,
      ];
    });
}

export function thirdPartyLicenses(licenseDirectory: string): Plugin {
  return {
    name: 'career-os:third-party-licenses',
    apply: 'build',
    generateBundle: {
      // Vite emits its bundled-package inventory in the default hook order.
      order: 'post',
      handler(_options, bundle) {
        const metadata = bundle[licenseMetadataFile];
        if (metadata?.type !== 'asset') {
          this.error('Third-party license inventory is missing.');
        }
        const source =
          typeof metadata.source === 'string'
            ? metadata.source
            : new TextDecoder().decode(metadata.source);
        const entries = licenseEntriesSchema.parse(JSON.parse(source));
        const directories = new Map<string, string>();
        const modulePackages = new Map<string, InstalledPackage | undefined>();
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk') continue;
          for (const moduleId of chunk.moduleIds) {
            if (
              moduleId.startsWith('\0') ||
              !moduleId.includes('node_modules')
            ) {
              continue;
            }
            const moduleDirectory = dirname(moduleId.split('?')[0]);
            if (!modulePackages.has(moduleDirectory)) {
              modulePackages.set(moduleDirectory, findPackage(moduleId));
            }
            const pkg = modulePackages.get(moduleDirectory);
            if (!pkg) this.error(`Package metadata missing: ${moduleId}`);
            directories.set(`${pkg.name}@${pkg.version}`, pkg.directory);
          }
        }

        const notices = entries.map(({ name, version, identifier }) => {
          const key = `${name}@${version}`;
          const directory = directories.get(key);
          if (!directory) this.error(`Package directory missing: ${key}`);
          const files = readNoticeFiles(directory);
          const texts = files.map(
            ({ name, text }) => `--- ${name} ---\n\n${text}`,
          );
          if (!files.some(({ kind }) => kind === 'license')) {
            const fallback = licenseFallbacks.get(key);
            if (!fallback || identifier !== 'MIT') {
              this.error(
                `License text missing for ${key}; review before release.`,
              );
            }
            const text = readFileSync(
              join(licenseDirectory, fallback),
              'utf8',
            ).trim();
            if (!text) this.error(`Empty fallback license for ${key}.`);
            texts.unshift(`--- Reviewed upstream LICENSE ---\n\n${text}`);
          }
          return [
            `${name} ${version}`,
            `Package metadata license: ${identifier}`,
            ...texts,
          ].join('\n\n');
        });

        this.emitFile({
          type: 'asset',
          fileName: thirdPartyNoticesFile,
          source: [
            'CareerOS Web - Third-party licenses and notices',
            'The following notices cover dependencies bundled in this build.',
            'Package metadata is informational; the full license texts follow.',
            'ChatKit packages may declare MIT in metadata while shipping an Apache-2.0 LICENSE. The bundled Apache-2.0 terms are reproduced below.',
            'Lucide includes ISC terms and MIT terms for Feather-derived icons. Both notices are preserved in full.',
            ...notices,
            '',
          ].join('\n\n'),
        });
        delete bundle[licenseMetadataFile];
      },
    },
  };
}
