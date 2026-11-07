import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { build } from 'vite-plus';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
  licenseMetadataFile,
  thirdPartyLicenses,
  thirdPartyNoticesFile,
} from './third-party-licenses';

const fixtures: string[] = [];

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true });
});

function createFixture({
  name = 'fixture-dependency',
  version = '1.0.0',
  license = 'MIT',
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'career-os-licenses-'));
  fixtures.push(root);
  const dependency = join(root, 'node_modules', name);
  mkdirSync(dependency, { recursive: true });
  writeFileSync(
    join(dependency, 'package.json'),
    JSON.stringify({
      name,
      version,
      license,
      type: 'module',
      main: 'index.js',
    }),
  );
  writeFileSync(join(dependency, 'index.js'), 'export const value = 42;');
  writeFileSync(join(root, 'index.js'), `export { value } from '${name}';`);
  return { root, dependency };
}

async function buildFixture(root: string) {
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [thirdPartyLicenses(join(process.cwd(), 'licenses'))],
    build: {
      write: false,
      license: { fileName: licenseMetadataFile },
      lib: { entry: join(root, 'index.js'), formats: ['es'] },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const files = outputs.flatMap((output) => {
    if (!('output' in output)) throw new Error('Expected a completed build.');
    return output.output;
  });
  const notice = files.find((file) => file.fileName === thirdPartyNoticesFile);
  if (notice?.type !== 'asset' || typeof notice.source !== 'string') {
    throw new Error('Expected a text notice asset.');
  }
  expect(files.some((file) => file.fileName === licenseMetadataFile)).toBe(
    false,
  );
  expect(existsSync(join(root, 'dist'))).toBe(false);
  return notice.source;
}

describe('third-party license distribution', () => {
  it('preserves all license files and NOTICE, including nested vendor notices', async () => {
    const { root, dependency } = createFixture();
    const originals = {
      LICENSE: 'MIT License\nCopyright fixture author\nPermission granted.',
      'LICENSE.vendor':
        'BSD License\nCopyright vendor author\nVendor conditions.',
      NOTICE: 'Required upstream attribution.',
      'LICENSES/nested.txt':
        'Copyright nested vendor\nNested license conditions.',
    };
    for (const [file, text] of Object.entries(originals)) {
      mkdirSync(dirname(join(dependency, file)), { recursive: true });
      writeFileSync(join(dependency, file), text);
    }
    const notices = await buildFixture(root);
    for (const text of Object.values(originals))
      expect(notices).toContain(text);
    expect(notices).toContain('fixture-dependency 1.0.0');
  });

  it('rejects a NOTICE-only package instead of treating it as a license', async () => {
    const { root, dependency } = createFixture();
    writeFileSync(join(dependency, 'NOTICE'), 'Attribution without a license.');
    await expect(buildFixture(root)).rejects.toThrow('License text missing');
  });

  it('includes a reviewed fallback for the exact installed version', async () => {
    const { root } = createFixture({
      name: '@stylexjs/stylex',
      version: '0.19.1',
    });
    expect(await buildFixture(root)).toContain(
      'Copyright (c) Meta Platforms, Inc. and affiliates.',
    );
  });

  it('does not reuse an old fallback after a dependency upgrade', async () => {
    const { root } = createFixture({
      name: '@stylexjs/stylex',
      version: '0.19.2',
    });
    await expect(buildFixture(root)).rejects.toThrow('License text missing');
  });

  it('rejects missing license metadata even when a LICENSE file exists', async () => {
    const { root, dependency } = createFixture({ license: '' });
    writeFileSync(
      join(dependency, 'LICENSE'),
      'MIT License\nCopyright fixture.',
    );
    await expect(buildFixture(root)).rejects.toThrow('identifier');
  });
});
