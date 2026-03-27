const path = require('path');
const dotenv = require('dotenv');

// Load the API .env file
const apiEnv = dotenv.config({
  path: path.resolve(__dirname, 'apps/api/.env'),
}).parsed || {};

module.exports = {
  apps: [
    {
      name: 'netmon-api',
      cwd: path.resolve(__dirname, 'apps/api'),
      script: 'dist/main.js',
      env: {
        ...apiEnv,
        NODE_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
    {
      name: 'netmon-web',
      cwd: path.resolve(__dirname, 'apps/web'),
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
  ],
};
