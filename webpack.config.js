const path = require('path');
module.exports = {
    target:'node',
    entry: './src/app-multiple-account.js',
    output: {
    filename: 'app-multiple-account.js',
    path: path.resolve(__dirname, 'dist'),
  },
};