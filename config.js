// https://github.com/confluentinc/examples/blob/5.5.1-post/clients/cloud/nodejs/config.js

const fs = require('fs');
const readline = require('readline');

function readAllLines(path) {    
    return new Promise((resolve, reject) => {
      let lines = [];

      let stream = fs.createReadStream(path);
      stream.on('error', (err) => {
        console.warn('Read stream err', err);
        resolve([]);
      });
      
      let reader = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });
      
      reader
        .on('line', (line) => lines.push(line))
        .on('close', () => resolve(lines));
    });
  }

exports.read = async (path) => {
    const lines = await readAllLines(path);
  
    return lines
      .filter((line) => !/^\s*?#/.test(line))
      .map((line) => line
        .split('=')
        .map((s) => s.trim()))
      .reduce((config, [k, v]) => {
        config[k] = v;
        return config;
      }, {});
  };