const http = require('http');
const { spawnSync } = require('child_process');

function check() {
  http.get('http://127.0.0.1:5173', (res) => {
    if (res.statusCode < 500) {
      console.log('[wait-electron] Vite ready, starting Electron...');
      spawnSync('npm', ['run', 'dev:electron'], { stdio: 'inherit', shell: true });
    } else {
      setTimeout(check, 500);
    }
    res.resume();
  }).on('error', () => setTimeout(check, 500));
}

check();
