var express = require('express');
var app = express();
const SerialPort = require('serialport'); //https://serialport.io/docs/guide-usage
const Readline = require('@serialport/parser-readline');

const port = new SerialPort('COM4', { baudRate: 9600 });
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