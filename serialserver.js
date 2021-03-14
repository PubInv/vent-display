#!/usr/bin/env node
var argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: $0 -sport [string, seraiport name] -uport [num,reporting port] -uaddress [string, like "127.0.0.1" or "ventmon.coslabs.com"]\nTo do no UDP reporting, leave off uport and uaddress.\nStandard uport is 6111, standard UDP is "ventmon.coslabs.com" or "127.0.0.1"')
    .default('sport', "COM4")
    .demandOption(['sport'])
    .argv;
var express = require('express');
const cors = require('cors');
var app = express();
app.use(cors());

// NOTE: We could enumerate porst with "SerialPort.list()"...
// that would be a little friendlier for people who can't find
// the filename of their serial port!
const SerialPort = require('serialport'); //https://serialport.io/docs/guide-usage
const Readline = require('@serialport/parser-readline');

const sport_name = argv.sport;
const uport = argv.uport;
const uaddress = argv.uaddress;
const NO_UDP = ((uport == null) && (uaddress == null))

console.log("Parameters:");
console.log("argv.sport",argv.sport);
console.log("sport_name (Serial Port name)",sport_name);
console.log("uport (UDP port)",uport);
console.log("uaddress (UDP address)",uaddress);
if (NO_UDP) {
  console.log("Becaue uport and uaddress both null, doing no UDP reporting!");
}


const sport = new SerialPort(sport_name, { baudRate: 19200 });

const parser = sport.pipe(new Readline());// Read the port data

// Rob is adding the ability to send UDP datagrams to make this work with our datalake!
// Okay, this code basically works---but I might have to fill a byte buffer.
const dgram = require('dgram');

sport.on("open", () => {
  console.log('serial port open');
});

// Open errors will be emitted as an error event
sport.on('error', function(err) {
  console.log('Error: ', err.message)
})

// Note: I now believe we need to listen here for
// Acknowledgements and do something special with them to
// thottle the serial buffer.

parser.on('data', data =>{
  // Let's see if the data is a PIRDS event...
  // Note: The PIRDSlogger accepts JSON, but I'm not sure we ever implemented that
  // being interpreted as a message. That possibly should be fixed, but I'm going to just
  // construct a buffer here.
  if (!NO_UDP) {
    // This is an erroneous form that we have seen in crashes, but I don't know where it comes from.
//    data = '{ "com" : "C" , "par" : "E" , "int" : "T" "A" , "val" : 150 }';

    const message = new Buffer(data);
    const client = dgram.createSocket('udp4');
    //    client.send(message, 0, message.length, 6111,"ventmon.coslabs.com", (err) => {
  client.send(message, 0, message.length, uport, uaddress, (err) => {
    if (err) {
      console.log(err);
    }
      client.close();
  });
  }
  console.log(data);
});


// parser.on('data', console.log)

app.get('/', function(req, res) {
	res.send('Hello world');
	sport.write('hello world\n', (err) => {
		if (err) {
		  return console.log('Error on write: ', err.message);
		}
	});
})

app.get('/api/set', function(req, res) {
    var x = '';
	if (req.query.rr){
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
app.get('/api/pircs', function(req, res) {
	var err = '';
    var x = '{ ';
	if (req.query.com){
		x += '"com" : "' + req.query.com + '" , ';
	} else {
		err += "com not defined! ";
	}
	if (req.query.par){
		x += '"par" : "' + req.query.par + '" , ';
	} else {
		err += "par not defined! ";
	}
	if (req.query.int){
		x += '"int" : "' + req.query.int + '" , ';
	} else {
		err += "int not defined! ";
	}
	if (req.query.mod){
		x += '"mod" : "' + req.query.mod + '" , ';
	} else {
		err += "mod not defined! ";
	}
	if (req.query.val){
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
	if (err.length > 0){
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
          // Howewver, we are fundamentally asynchronous in processing
          // requests, so it is unclear how this would work!
          // Possibly we could call drain first!
          sport.drain( () =>
		sport.write(x, (err) => {
			if (err) {
			return console.log('Error on write: ', err.message);
			}
		}));
	}
});

// /api/pircs2/C/P/T/0/400
app.get('/api/pircs2/:com/:par/:int/:mod/:val', function(req,res) {
	res.send(req.params);
	sport.write(JSON.stringify(req.params)+'\n', (err) => {
		if (err) {
		  return console.log('Error on write: ', err.message);
		}
	});

	// JSON.stringify returns: {"com":"C","par":"P","int":"T","mod":"0","val":"400"}
})

/*app.get('/rr/:rr', function(req,res) {
	res.send(req.params);
	port.write(JSON.stringify(req.params)+'\n', (err) => {
		if (err) {
		  return console.log('Error on write: ', err.message);
		}
	});
})*/

var server = app.listen(5000, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log("Node.js server running on port %s", port);
})
