import './server.js';
import { spawn } from 'child_process';

// Windows/PowerShell can throw spawn EINVAL when trying to execute npx.cmd directly
// from an ES module child process. Running through the shell is more reliable cross-platform.
const child = spawn('npx vite --host 0.0.0.0', {
  stdio: 'inherit',
  shell: true,
  windowsHide: true
});

child.on('error', (error) => {
  console.error('Vite konnte nicht gestartet werden:', error);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
