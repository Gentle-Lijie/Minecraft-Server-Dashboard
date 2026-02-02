const { exec } = require('child_process');

function runCmd(command) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr.trim() || stdout.trim() || err.message));
      resolve(stdout.trim());
    });
  });
}

// System process blacklist (Linux/Mac)
const SYSTEM_PROCS = new Set([
  'systemd', 'kthreadd', 'rcu_gp', 'rcu_par_gp', 'kworker', 'ksoftirqd',
  'migration', 'watchdog', 'cpuhp', 'init', 'launchd',
  'kernel_task', 'WindowServer', 'loginwindow',
]);

async function getServiceStatus(serviceName) {
  // Try pm2 first, fall back to systemctl
  try {
    const output = await runCmd(`pm2 jlist`);
    const list = JSON.parse(output);
    const proc = list.find(p => p.name === serviceName);
    if (proc) {
      const status = proc.pm2_env.status === 'online' ? 'running' : 'stopped';
      return { status, raw: `pm2: ${proc.pm2_env.status}` };
    }
  } catch {}

  try {
    const output = await runCmd(`systemctl is-active ${serviceName}`);
    const status = output === 'active' ? 'running' : output === 'inactive' ? 'stopped' : 'unknown';
    return { status, raw: `systemctl: ${output}` };
  } catch (e) {
    return { status: 'error', raw: e.message };
  }
}

async function startService(serviceName) {
  // Try pm2 first
  try {
    await runCmd(`pm2 start ${serviceName}`);
    await new Promise(r => setTimeout(r, 1000));
    const result = await getServiceStatus(serviceName);
    return { success: true, message: result.status === 'running' ? 'Service started' : 'Start command sent' };
  } catch {}

  try {
    await runCmd(`sudo systemctl start ${serviceName}`);
    await new Promise(r => setTimeout(r, 1000));
    const result = await getServiceStatus(serviceName);
    return { success: true, message: result.status === 'running' ? 'Service started' : 'Start command sent' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function stopService(serviceName) {
  try {
    await runCmd(`pm2 stop ${serviceName}`);
    await new Promise(r => setTimeout(r, 1000));
    const result = await getServiceStatus(serviceName);
    return { success: true, message: result.status === 'stopped' ? 'Service stopped' : 'Stop command sent' };
  } catch {}

  try {
    await runCmd(`sudo systemctl stop ${serviceName}`);
    await new Promise(r => setTimeout(r, 1000));
    const result = await getServiceStatus(serviceName);
    return { success: true, message: result.status === 'stopped' ? 'Service stopped' : 'Stop command sent' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function killProcess(pid) {
  await runCmd(`kill -9 ${parseInt(pid)}`);
}

function filterProcess(proc) {
  const name = proc.name.toLowerCase();
  return proc.pid > 1 && !SYSTEM_PROCS.has(name) && !name.startsWith('kworker');
}

module.exports = { getServiceStatus, startService, stopService, killProcess, filterProcess };
