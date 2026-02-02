module.exports = {
  apps: [{
    name: 'mc-dashboard',
    script: 'server.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
