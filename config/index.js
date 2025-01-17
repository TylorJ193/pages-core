const fs = require('fs');
const path = require('path');
const deepExtend = require('deep-extend');

const config = {};

function validConfigFile(filename) {
  return (
    path.extname(filename) === '.js'
    && filename !== 'index.js'
    && filename !== 'local.js'
    && !filename.match(/.*\.sample\.js/)
  );
}

fs.readdirSync(__dirname)
  .filter(validConfigFile)
  .forEach((filename) => {
    const configName = path.basename(filename, '.js');
    const filepath = path.join(__dirname, filename);
    // eslint-disable-next-line global-require, import/no-dynamic-require
    config[configName] = require(filepath);
  });

if (fs.existsSync(path.join(__dirname, 'local.js'))) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  deepExtend(config, require(path.join(__dirname, 'local.js')));
}

if (fs.existsSync(path.join(__dirname, 'local-from-staging.js'))) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  deepExtend(config, require(path.join(__dirname, 'local-from-staging.js')));
}

const environment = process.env.NODE_ENV;

if (environment) {
  const environmentFilepath = path.join(__dirname, 'env', `${environment}.js`);
  if (fs.existsSync(environmentFilepath)) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    deepExtend(config, require(environmentFilepath));
  }
}

module.exports = config;
