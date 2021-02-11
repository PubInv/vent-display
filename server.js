var express = require('express');
const cors = require('cors');
var app = express();
app.use(cors());
const SerialPort = require('serialport'); //https://serialport.io/docs/guide-usage
const Readline = require('@serialport/parser-readline');

// const port = new SerialPort('/dev/cu.usbmodem142401', { baudRate: 19200 });
const port = new SerialPort('/dev/cu.usbserial-01D9677E', { baudRate: 19200 });
// const port = new SerialPort('COM4', { baudRate: 9600 });
const parser = port.pipe(new Readline());// Read the port data



port.on("open", () => {
  console.log('serial port open');
});

// Open errors will be emitted as an error event
port.on('error', function(err) {
  console.log('Error: ', err.message)
})

parser.on('data', data =>{
  console.log(data);
});


// parser.on('data', console.log)

app.get('/', function(req, res) {
	res.send('Hello world');
	port.write('hello world\n', (err) => {
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

	port.write(x, (err) => {
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
		x += '"mod" : ' + req.query.mod + ' , ';
	} else {
		err += "mod not defined! ";
	}
	if (req.query.val){
		x += '"val" : ' + req.query.val;
	} else {
		err += "val not defined! ";
	}
	x += ' }\n';

	if (err.length > 0){
		err += "\n"
		res.setHeader("Content-Type", "text/plain");
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.status(400).send(err);
	} else {

		res.setHeader("Content-Type", "application/json");
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.status(200).send(x);
          console.log("About to write:");
          console.log(x);
          console.log("done");
		port.write(x, (err) => {
			if (err) {
			return console.log('Error on write: ', err.message);
			}
		});
	}

	// { "com" : "C" , "par" : "P" , "int" : "T" , "mod" : 0 , "val" : 400 }
});

// /api/pircs2/C/P/T/0/400
app.get('/api/pircs2/:com/:par/:int/:mod/:val', function(req,res) {
	res.send(req.params);
	port.write(JSON.stringify(req.params)+'\n', (err) => {
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
