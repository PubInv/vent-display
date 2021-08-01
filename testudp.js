/*
The Vent-display project is a ventilator display that consumes PIRDS data and
performs most clinical respiration calculations. This is an important part of
Public Invention's goal of creating an open-source ventilator ecosystem. This
is a stand-alone .html file with about a thousand lines of JavaScript that
implements a clinical display that doctors want to see of an operating
ventilator. It includes live data trace plots of pressure and flow, as well as
calculated values such as tidal volume.
Copyright (C) 2021 Robert Read, Lauria Clarke, Ben Coombs, and Darío Hereñú.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.
You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

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
