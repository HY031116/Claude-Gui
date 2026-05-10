/**
 * 开发模式 Electron 启动器，支持主进程热重载
 * 监听 dist-electron/ 目录变化，自动 kill 并重启 Electron
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 确保以 GUI 模式而非 Node 模式运行 Electron
delete process.env.ELECTRON_RUN_AS_NODE;

const electronPath = require('electron');
const distDir = path.join(__dirname, '..', 'dist-electron');

let child = null;
let debounceTimer = null;
// 标记是否由我们主动 kill（区分"主动重启"与"用户关闭窗口"）
let wasKilledByUs = false;
// 启动冷却期：进程启动后的前 N 毫秒内忽略 fs.watch 触发，
// 防止 tsc --watch 初始编译重写 dist-electron/ 时触发多余重启
const BOOT_GRACE_MS = 5000;
const bootTime = Date.now();

function startElectron() {
  // 先 kill 旧进程
  if (child) {
    wasKilledByUs = true;
    try { child.kill(); } catch {}
  }

  // 等待 kill 完成后再启动新进程
  setTimeout(() => {
    wasKilledByUs = false;
    console.log('\n[dev-reload] 启动 Electron...');

    child = spawn(electronPath, ['.'], {
      stdio: 'inherit',
      env: { ...process.env },
      windowsHide: false,
    });

    child.on('close', (code) => {
      // 如果是被我们 kill 的，忽略退出事件（等待重启）
      if (wasKilledByUs) return;
      // 用户关闭窗口或 Electron 正常退出 → 整个 dev 进程退出
      process.exit(code ?? 0);
    });
  }, 300);
}

// 监听 dist-electron/ 变化（tsc 重新编译主进程后触发）
fs.watch(distDir, { recursive: false }, (event, filename) => {
  // 只关注 .js 文件（tsc 输出），排除 package.json
  if (!filename || !filename.endsWith('.js')) return;

  // 冷却期内忽略事件（tsc --watch 初始全量编译导致的噪音）
  if (Date.now() - bootTime < BOOT_GRACE_MS) return;

  clearTimeout(debounceTimer);
  // 防抖 500ms：等 tsc 把所有文件写完再重启，避免中途启动
  debounceTimer = setTimeout(() => {
    console.log(`\n[dev-reload] ${filename} 已更新，正在重启 Electron...`);
    startElectron();
  }, 500);
});

// 初次启动
startElectron();

// 父进程（concurrently）退出时清理子进程
['SIGTERM', 'SIGINT'].forEach((sig) => {
  process.on(sig, () => {
    if (child) try { child.kill(); } catch {}
    process.exit(0);
  });
});
