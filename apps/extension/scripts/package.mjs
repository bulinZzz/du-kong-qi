/**
 * 打出可上传到 Chrome 应用商店的包。
 *
 * 与开发构建的三点差别：后端地址按 BACKEND_ORIGIN 注入、manifest 的 host 权限换成生产来源、
 * 不含 sourcemap。成品落在 release/ 下（该目录不入版本库）。
 *
 * 用法：
 *   PowerShell: $env:BACKEND_ORIGIN='https://api.example.com'; npm run package
 *   bash:       BACKEND_ORIGIN=https://api.example.com npm run package
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const release = join(root, 'release');

const origin = process.env.BACKEND_ORIGIN;
if (!origin || !origin.startsWith('https://')) {
    console.error('BACKEND_ORIGIN 必须是生产环境的 https 地址，且不能省略。');
    console.error("例：$env:BACKEND_ORIGIN='https://api.example.com'; npm run package");
    process.exit(1);
}

// 一并注入到后台脚本与 manifest：两者指的必须是同一个来源。
execFileSync('npm run build', {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, BACKEND_ORIGIN: origin },
});

const version = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')).version;
const staging = join(release, `du-kong-qi-${version}`);
const zipPath = join(release, `du-kong-qi-${version}.zip`);

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
copyWithoutSourcemaps(dist, staging);

const manifestPath = join(staging, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.host_permissions = [`${origin}/*`];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

rmSync(zipPath, { force: true });
zip(staging, zipPath);

console.log(`\n上传这个文件：${relative(process.cwd(), zipPath)}`);
console.log(`  后端地址  ${origin}`);
console.log(`  版本      ${version}`);
console.log(`  内容      ${countFiles(staging)} 个文件，${(statSync(zipPath).size / 1024).toFixed(1)} KB（已去掉 sourcemap）`);
console.log(`  可直接加载的目录  ${relative(process.cwd(), staging)}`);

/** 复制产物但不带 sourcemap：开发时留着方便，上传时不必带。 */
function copyWithoutSourcemaps(from, to) {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
        if (entry.name.endsWith('.map')) {
            continue;
        }
        const source = join(from, entry.name);
        const target = join(to, entry.name);
        if (entry.isDirectory()) {
            mkdirSync(target, { recursive: true });
            copyWithoutSourcemaps(source, target);
        } else {
            cpSync(source, target);
        }
    }
}

function zip(from, to) {
    if (process.platform === 'win32') {
        execFileSync('powershell', [
            '-NoProfile',
            '-Command',
            `Compress-Archive -Path '${from}\\*' -DestinationPath '${to}' -Force`,
        ], { stdio: 'inherit' });
    } else {
        execFileSync('zip', ['-r', '-q', to, '.'], { cwd: from, stdio: 'inherit' });
    }
}

function countFiles(directory) {
    return readdirSync(directory, { withFileTypes: true })
        .reduce((total, entry) => total
            + (entry.isDirectory() ? countFiles(join(directory, entry.name)) : 1), 0);
}
