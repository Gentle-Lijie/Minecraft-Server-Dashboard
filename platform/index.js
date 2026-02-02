const os = require('os');
const platform = os.platform();

if (platform === 'win32') {
  module.exports = require('./windows');
} else {
  // linux, darwin (macOS), freebsd, etc.
  module.exports = require('./linux');
}
