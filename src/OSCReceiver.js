const osc = require('node-osc');

const oscServer = new osc.Server(57122, '0.0.0.0');
oscServer.on('message', (msg, rinfo) => {
	console.log('MSG');
	console.log(msg);
});
