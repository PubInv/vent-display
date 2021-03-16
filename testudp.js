#!/usr/bin/env node
var argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: $0 -sport [string, seraiport name] -uport [num,reporting port] -uaddress [string, like "127.0.0.1" or "ventmon.coslabs.com"]\nTo do no UDP reporting, leave off uport and uaddress.\nStandard uport is 6111, standard UDP is "ventmon.coslabs.com" or "127.0.0.1"')
    .default('sport', "COM4")
    .demandOption(['sport'])
    .argv;
// NOTE: We could enumerate porst with "SerialPort.list()"...
// that would be a little friendlier for people who can't find
// the filename of their serial port!

const uport = argv.uport;
const uaddress = argv.uaddress;
const NO_UDP = ((uport == null) && (uaddress == null))

console.log("Parameters:");
console.log("uport (UDP port)",uport);
console.log("uaddress (UDP address)",uaddress);
if (NO_UDP) {
  console.log("Becaue uport and uaddress both null, doing no UDP reporting!");
}

const dgram = require('dgram');
data = '{ "com" : "C" , "par" : "E" , "int" : "T" "A" , "val" : 150 }';
function send_udp() {
  const message = new Buffer(data);
  const client = dgram.createSocket('udp4');
  client.send(message, 0, message.length, uport, uaddress, (err) => {
    if (err) {
      console.log(err);
    }
    client.close();
  });
  console.log(data);
}

setInterval(send_udp, 3000);
