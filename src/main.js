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
	if (msg.address === '/speed') {
		timePerDay = msg.args[0];
	} else if (msg.address === '/play') {
		repeat();
	} else if (msg.address === '/pause') {
		clearTimeout(timeout);
	} else if (msg.address === '/stop') {
		dayOffset = 0;
		clearTimeout(timeout);
	}
});

const sendOSC = data => {
	if (ready) {
		data.forEach(d => {
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
let timePerDay = 1000;
// logging initial values
console.log(startDate.format('dddd D MMMM YYYY'));
console.log(endDate.format('dddd D MMMM YYYY'));
console.log(duration);

let dayOffset = 0;

const repeat = () => {
	const dateToFind = startDate.clone().add(dayOffset, 'days');
	const current = data.filter(d => {
		const mDate = moment(d.date).tz('Europe/Paris');
		return mDate.isSame(dateToFind, 'day');
	});
	console.log(dateToFind.format('dddd D MMMM YYYY'));
	sendOSC(current);
	dayOffset++;
	if (dayOffset > duration) dayOffset = 0;
	timeout = setTimeout(repeat, timePerDay);
};
