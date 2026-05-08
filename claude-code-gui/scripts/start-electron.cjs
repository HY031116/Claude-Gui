const { spawn } = require('child_process');

// Remove ELECTRON_RUN_AS_NODE to ensure Electron runs in GUI mode, not Node mode
delete process.env.ELECTRON_RUN_AS_NODE;

const electronPath = require('electron');
const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: process.env,
  windowsHide: false,
});

child.on('close', (code, signal) => {
  if (code === null) {
    console.error(electronPath, 'exited with signal', signal);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
