const moment = require('moment-timezone');
const osc = require('osc');
const data = require('../data/data.json');

let timeout;

const udpPort = new osc.UDPPort({
	localAddress: '127.0.0.1',
	localPort: 57121,
	remoteAddress: '127.0.0.1',
	remotePort: 57122,
});
udpPort.open();
let ready = false;
udpPort.on('ready', () => {
	ready = true;
});
udpPort.on('message', msg => {
	if (msg.address === '/next') {
		next();
	} else if (msg.address === '/reset') {
		dayOffset = 0;
		dead = 0;
		missing = 0;
		deadormissing = 0;
	}
});
// Totals:
// deads: 3799
// missigns: 4786
// dead or missigns: 32964
let dead = 0;
let missing = 0;
let deadormissing = 0;
const sendOSC = data => {
	if (ready) {
		data.forEach(d => {
			dead += d.dead;
			missing += d.missing;
			deadormissing += d.deadormissing;
			udpPort.send({
				timeTag: osc.timeTag(0),
				packets: [
					{
						address: '/event/count',
						args: [
							{
								type: 'f',
								value: d.missing,
							},
							{
								type: 'f',
								value: d.dead,
							},
							{
								type: 'f',
								value: d.deadormissing,
							},
						],
					},
					{
						address: '/event/total',
						args: [
							{
								type: 'f',
								value: missing,
							},
							{
								type: 'f',
								value: dead,
							},
							{
								type: 'f',
								value: deadormissing,
							},
						],
					},
					{
						address: '/event/latlon',
						args: [
							{
								type: 'f',
								value: d.lat,
							},
							{
								type: 'f',
								value: d.lon,
							},
						],
					},
					{
						address: '/event/cause',
						args: [
							{
								type: 's',
								value: d.cause,
							},
						],
					},
				],
			});
		});
	}
};

moment.locale('fr');

// first sort data per date
data.sort((a, b) => {
	const aDate = new Date(a.date);
	const bDate = new Date(b.date);
	if (aDate < bDate) return -1;
	if (aDate > bDate) return 1;
	return 0;
});

const startDate = moment(data[0].date).tz('Europe/Paris');
const endDate = moment(data[data.length - 1].date).tz('Europe/Paris');
const duration = endDate.diff(startDate, 'days');
let timePerDay = 10;
// logging initial values
console.log(startDate.format('dddd D MMMM YYYY'));
console.log(endDate.format('dddd D MMMM YYYY'));
console.log(duration);

let dayOffset = 0;

const next = () => {
	const dateToFind = startDate.clone().add(dayOffset, 'days');
	const current = data.filter(d => {
		const mDate = moment(d.date).tz('Europe/Paris');
		return mDate.isSame(dateToFind, 'day');
	});
	const currentDate = dateToFind.format('dddd D MMMM YYYY');
	console.log(currentDate);
	sendOSC(current);
	enqueue(current, currentDate);
	print();
	dayOffset++;
	if (dayOffset > duration) {
		dayOffset = 0;
		dead = 0;
		missing = 0;
		deadormissing = 0;
	}
};

// printer
const SerialPort = require('serialport');
const serialPort = new SerialPort('COM3', { baudRate: 19200 });
const Printer = require('thermalprinter');

let printer;

serialPort.on('open', () => {
	printer = new Printer(serialPort);
	printer.on('ready', () => {
		printer.upsideDown(true);
		console.log('ready');
	});
});

const queue = [];

const enqueue = (data, date) => {
	if (data.length > 0) {
		const current = [];
		let count = 0;
		let causes = [];
		data.forEach(d => {
			count += d.deadormissing;
			causes.push(d.cause.replace(/_/gi, ' '));
		});
		[...new Set(causes)].forEach(c => {
			current.push(c);
		});
		current.push(`cause${count > 1 ? 's' : ''} :`);
		current.push(`mort${count > 1 ? 's' : ''} : ${count}`);
		current.push(date);
		queue.push(current);
	}
};

let canPrint = true;
const print = () => {
	if (canPrint) {
		const current = queue.shift();
		if (current) {
			canPrint = false;
			current.forEach(c => {
				printer.printLine(c);
			});
			printer.horizontalLine(16);
			printer.lineFeed(1);
			printer.print(() => {
				canPrint = true;
				if (queue.length > 0) print();
			});
		}
	}
};
