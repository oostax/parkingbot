const { exec } = require('child_process');
const path = require('path');

console.log('Restarting stats-daemon...');

// Используем pm2 для перезапуска daemon
exec('pm2 restart stats-daemon', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error restarting daemon: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
  }
  console.log(`Daemon restarted successfully.`);
  console.log(`Stdout: ${stdout}`);
}); 