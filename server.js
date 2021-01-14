var http = require('http'); // Import Node.js core module
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


var server = http.createServer(function (req, res) {   //create web server
    if (req.url == '/') { //check the URL of the current request
        port.write('testing testing hello ben\n', (err) => {
			if (err) {
			  return console.log('Error on write: ', err.message);
			}
		});
        // set response header
        res.writeHead(200, { 'Content-Type': 'text/html' }); 
        
        // set response content    
        res.write('<html><body><p>Sending message via serial!</p></body></html>');
        res.end();
    
    }
    else
        res.end('Invalid Request!');

});

server.listen(5000); //6 - listen for any incoming requests

console.log('Node.js web server at port 5000 is running..')