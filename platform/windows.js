const { exec } = require('child_process');

// Windows: decode GBK output from cmd
function runCmd(command) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 15000, encoding: 'buffer' }, (err, stdout, stderr) => {
      const decode = buf => {
        try { return new TextDecoder('gbk').decode(buf).trim(); }
        catch { return buf.toString('utf-8').trim(); }
      };
      const out = decode(stdout);
      const errOut = decode(stderr);
      if (err) return reject(new Error(errOut || out || err.message));
      resolve(out);
    });
  });
}

// System process blacklist
const SYSTEM_PROCS = new Set([
  'system idle process', 'system', 'registry', 'smss.exe', 'csrss.exe',
  'wininit.exe', 'services.exe', 'lsass.exe', 'svchost.exe', 'dwm.exe',
  'fontdrvhost.exe', 'winlogon.exe', 'lsaiso.exe', 'sgrmbroker.exe',
  'memory compression', 'ntoskrnl.exe', 'secure system', 'spoolsv.exe',
  'searchindexer.exe', 'msdtc.exe', 'dllhost.exe', 'wudfhost.exe',
  'dashost.exe', 'sihost.exe', 'ctfmon.exe', 'conhost.exe',
  'runtimebroker.exe', 'systemidleprocess',
]);

async function getServiceStatus(serviceName) {
  try {
    const output = await runCmd(`sc query "${serviceName}"`);
    const running = output.includes('RUNNING');
    const stopped = output.includes('STOPPED');
    const paused = output.includes('PAUSED');
    return {
      status: running ? 'running' : stopped ? 'stopped' : paused ? 'paused' : 'unknown',
      raw: output,
    };
  } catch (e) {
    return { status: 'error', raw: e.message };
  }
}

async function startService(serviceName) {
  try { await runCmd(`nssm start ${serviceName}`); } catch {}
  await new Promise(r => setTimeout(r, 1000));
  const result = await getServiceStatus(serviceName);
  return {
    success: true,
    message: result.status === 'running' ? 'Service started' : 'Start command sent, waiting...',
  };
}

async function stopService(serviceName) {
  try { await runCmd(`nssm stop ${serviceName}`); } catch {}
  await new Promise(r => setTimeout(r, 1000));
  const result = await getServiceStatus(serviceName);
  return {
    success: true,
    message: result.status === 'stopped' ? 'Service stopped' : 'Stop command sent, waiting...',
  };
}

async function killProcess(pid) {
  await runCmd(`taskkill /PID ${parseInt(pid)} /F`);
}

function filterProcess(proc) {
  return proc.pid > 4 && !SYSTEM_PROCS.has(proc.name.toLowerCase());
}

module.exports = { getServiceStatus, startService, stopService, killProcess, filterProcess };
