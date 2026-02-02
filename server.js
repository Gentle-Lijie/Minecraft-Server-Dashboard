const express = require('express');
const jwt = require('jsonwebtoken');
const si = require('systeminformation');
const { Rcon } = require('rcon-client');
const fs = require('fs');
const path = require('path');
const platform = require('./platform');

// Load config
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

// Get RCON password: config > server.properties
function getRconPassword() {
  if (config.rcon.password) return String(config.rcon.password);
  try {
    const props = fs.readFileSync(config.serverPropertiesPath, 'utf-8');
    const match = props.match(/^rcon\.password=(.+)$/m);
    return match ? match[1].trim() : null;
  } catch (e) {
    console.error('Cannot read server.properties:', e.message);
    return null;
  }
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), config.jwtSecret);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (String(password) !== String(config.password)) {
    return res.status(403).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ role: 'admin', iat: Math.floor(Date.now() / 1000) }, config.jwtSecret, { expiresIn: '24h' });
  res.json({ token });
});

// GET /api/system
app.get('/api/system', auth, async (req, res) => {
  try {
    const [cpu, mem, disk, netStats, cpuTemp, osInfo, time, gpu] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.cpuTemperature(),
      si.osInfo(),
      si.time(),
      si.graphics(),
    ]);

    res.json({
      cpu: {
        load: Math.round(cpu.currentLoad * 100) / 100,
        cores: cpu.cpus.map(c => Math.round(c.load * 100) / 100),
        temp: cpuTemp.main,
      },
      memory: {
        total: mem.total,
        used: mem.used,
        active: mem.active,
        available: mem.available,
        percent: Math.round((mem.active / mem.total) * 10000) / 100,
      },
      disk: disk.map(d => ({
        fs: d.fs,
        mount: d.mount,
        size: d.size,
        used: d.used,
        percent: Math.round(d.use * 100) / 100,
      })),
      network: netStats.map(n => ({
        iface: n.iface,
        rx_sec: n.rx_sec,
        tx_sec: n.tx_sec,
        rx_bytes: n.rx_bytes,
        tx_bytes: n.tx_bytes,
      })),
      gpu: gpu.controllers.filter(g => g.vram > 0).map(g => ({
        model: g.model,
        vendor: g.vendor,
        vram: g.vram,
        temperatureGpu: g.temperatureGpu,
        utilizationGpu: g.utilizationGpu,
        utilizationMemory: g.utilizationMemory,
        memoryUsed: g.memoryUsed,
        memoryTotal: g.memoryTotal || g.vram,
      })),
      uptime: time.uptime,
      os: `${osInfo.distro} ${osInfo.release}`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/mc/status
app.get('/api/mc/status', auth, async (req, res) => {
  const result = await platform.getServiceStatus(config.mcServiceName);
  res.json(result);
});

// POST /api/mc/start
app.post('/api/mc/start', auth, async (req, res) => {
  try {
    const result = await platform.startService(config.mcServiceName);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/mc/stop
app.post('/api/mc/stop', auth, async (req, res) => {
  try {
    const result = await platform.stopService(config.mcServiceName);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/processes
app.get('/api/processes', auth, async (req, res) => {
  try {
    const procs = await si.processes();
    const sorted = procs.list
      .filter(platform.filterProcess)
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 30)
      .map(p => ({
        pid: p.pid,
        name: p.name,
        cpu: Math.round(p.cpu * 100) / 100,
        mem: Math.round(p.mem * 100) / 100,
        memRss: p.memRss,
        state: p.state,
      }));
    res.json({ processes: sorted, total: procs.all });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/processes/kill
app.post('/api/processes/kill', auth, async (req, res) => {
  const { pid } = req.body;
  if (!pid) return res.status(400).json({ error: 'No PID provided' });
  try {
    await platform.killProcess(pid);
    res.json({ success: true, message: `Process ${pid} killed` });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/mc/rcon
app.post('/api/mc/rcon', auth, async (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }

  const rconPassword = getRconPassword();
  if (!rconPassword) {
    return res.status(500).json({ error: 'Cannot read RCON password' });
  }

  let rcon;
  try {
    rcon = await Rcon.connect({
      host: config.rcon.host,
      port: config.rcon.port || 25575,
      password: rconPassword,
    });
    const response = await rcon.send(command);
    await rcon.end();
    res.json({ response });
  } catch (e) {
    if (rcon) try { await rcon.end(); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// Start server
app.listen(config.dashboardPort, '0.0.0.0', () => {
  console.log(`MC Dashboard running on http://0.0.0.0:${config.dashboardPort}`);
});
