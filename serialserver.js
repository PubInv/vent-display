#!/usr/bin/env node
var argv = require('yargs/yargs')(process.argv.slice(2))
	.usage('Usage: $0 -sport [string, seraiport name] -uport [num,reporting port] -uaddress [string, like "127.0.0.1" or "ventmon.coslabs.com"]\nTo do no UDP reporting, leave off uport and uaddress.\nStandard uport is 6111, standard UDP is "ventmon.coslabs.com" or "127.0.0.1"')
	.default('sport', "/dev/ttyACM0")
	.demandOption(['sport'])
	.argv;
var express = require('express');
const cors = require('cors');
const fs = require('fs');
var app = express();
app.use(cors());

// NOTE: We could enumerate ports with "SerialPort.list()"...
// that would be a little friendlier for people who can't find
// the filename of their serial port!
const SerialPort = require('serialport'); //https://serialport.io/docs/guide-usage
const Readline = require('@serialport/parser-readline');

const sport_name = argv.sport;
const uport = argv.uport;
const uaddress = argv.uaddress;
const NO_UDP = ((uport == null) && (uaddress == null))

console.log("Parameters:");
console.log("argv.sport", argv.sport);
console.log("sport_name (Serial Port name)", sport_name);
console.log("uport (UDP port)", uport);
console.log("uaddress (UDP address)", uaddress);
if (NO_UDP) {
	console.log("Because uport and uaddress are both null, we are not doing any UDP reporting!");
}

// VentOS uses 19200, but the VentMon uses 500000
const VentOSRate = 19200
const VentMon = 500000
const sport = new SerialPort(sport_name, { baudRate: VentOSRate });

const parser = sport.pipe(new Readline());// Read the port data

// Rob is adding the ability to send UDP datagrams to make this work with our datalake!
// Okay, this code basically works---but I might have to fill a byte buffer.
const dgram = require('dgram');

sport.on("open", () => {
	console.log('serial port open');
});

// Open errors will be emitted as an error event
sport.on('error', function (err) {
	console.log('Error: ', err.message)
})

// Note: I now believe we need to listen here for
// Acknowledgements and do something special with them to
// thottle the serial buffer.

var mark = 0;
var reset_mark = false;

parser.on('data', data => {
	// Let's see if the data is a PIRDS event...
	// Note: The PIRDSlogger accepts JSON, but I'm not sure we ever implemented that
	// being interpreted as a message. That possibly should be fixed, but I'm going to just
	// construct a buffer here.
	if (!NO_UDP) {
		// This is an erroneous form that we have seen in crashes, but I don't know where it comes from.
		//    data = '{ "com" : "C" , "par" : "E" , "int" : "T" "A" , "val" : 150 }';

		const message = new Buffer.from(data);
		const client = dgram.createSocket('udp4');
		//    client.send(message, 0, message.length, 6111,"ventmon.coslabs.com", (err) => {
		client.send(message, 0, message.length, uport, uaddress, (err) => {
			if (err) {
				console.log(err);
			}
			client.close();
		});
	}


	try {
		let ms = new Date().getTime(); // epoch time
		let d = JSON.parse(data);
		let t = d.ms - mark;
		console.log("t: " + t);
		if (reset_mark) {
			mark = d.ms;
			console.log("mark " + mark);
			reset_mark = false;
		}

		d.ms = ms;
		var ds = JSON.stringify(d);

		fs.appendFile('log.txt', ds, function (err) {
			if (err) return console.log(err);
		});
		//console.log(dataJson);
	} catch (error) {
		//console.error(error);
	}

	

	//console.log(data);
});


app.get('/api/set', function (req, res) {
	var x = '';
	if (req.query.rr) {
		x += '{"rr":"' + req.query.rr + '"}\n';
	}
	res.send(x);

	sport.write(x, (err) => {
		//console.log('wrote to port ' + x);
		if (err) {
			return console.log('Error on write: ', err.message);
		}
	});
});

// /api/pircs?com=C&par=P&int=T&mod=0&val=400
app.get('/api/pircs', function (req, res) {
	var err = '';
	var x = '{ ';
	if (req.query.com) {
		x += '"com" : "' + req.query.com + '" , ';
	} else {
		err += "com not defined! ";
	}
	if (req.query.par) {
		x += '"par" : "' + req.query.par + '" , ';
	} else {
		err += "par not defined! ";
	}
	if (req.query.int) {
		x += '"int" : "' + req.query.int + '" , ';
	} else {
		err += "int not defined! ";
	}
	if (req.query.mod) {
		x += '"mod" : "' + req.query.mod + '" , ';
	} else {
		err += "mod not defined! ";
	}
	if (req.query.val) {
		x += '"val" : ' + req.query.val;
	} else {
		err += "val not defined! ";
	}
	x += ' }\n';
	// I think what we want to do is await here until
	// we have gotten an acknowledgement of the command.
	// that requires us to add a specific listener to stream
	// we are reading to check it. This should help overiding the buffer.
	// A way around this is to just change the html to set one value
	// at a time. In any case there is a danger of a buffer overruns;
	// this is very clear seen to be happening in the VentOS code.
	if (err.length > 0) {
		err += "\n"
		res.setHeader("Content-Type", "text/plain");
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.status(400).send(err);
	} else {
		res.setHeader("Content-Type", "application/json");
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.status(200).send(x);
		// The documentaiton supports this:
		// function writeAndDrain (data, callback) {
		//  port.write(data)
		//  port.drain(callback)
		// }
		// However, we are fundamentally asynchronous in processing
		// requests, so it is unclear how this would work!
		// Possibly we could call drain first!
		sport.drain(() =>
			sport.write(x, (err) => {
				if (err) {
					return console.log('Error on write: ', err.message);
				}
			}));
	}
});

app.get('/', function (req, res) { 
	res.send('Server works!');
});

app.get('/api/stream', function (req, res) {
	fs.createReadStream('log.txt').pipe(res);
});

// /api/pircs2/C/P/T/0/400
app.get('/api/pircs2/:com/:par/:int/:mod/:val', function (req, res) {
	res.send(req.params);
	sport.write(JSON.stringify(req.params) + '\n', (err) => {
		if (err) {
			return console.log('Error on write: ', err.message);
		}
	});

	// JSON.stringify returns: {"com":"C","par":"P","int":"T","mod":"0","val":"400"}
})

var server = app.listen(3005, function () {
	setInterval(() => {
		reset_mark = true;
	}, 10000);
	
	//fs.writeFile('log.txt', 'empty');
	var host = server.address().address;
	var port = server.address().port;
	console.log("Node.js server running on %s:%s", host, port);
	
})


/*app.get('/rr/:rr', function(req,res) {
	res.send(req.params);
	port.write(JSON.stringify(req.params)+'\n', (err) => {
		if (err) {
		  return console.log('Error on write: ', err.message);
		}
	});
})*/


/*app.get('/', function (req, res) {
	res.send('Vent Display server is running!');
	sport.write('hello world\n', (err) => {
		if (err) {
			return console.log('Error on write: ', err.message);
		}
	});
})*/
