#
# The Vent-display project is a ventilator display that consumes PIRDS data and
# performs most clinical respiration calculations. This is an important part of
# Public Invention's goal of creating an open-source ventilator ecosystem. This
# is a stand-alone .html file with about a thousand lines of JavaScript that
# implements a clinical display that doctors want to see of an operating
# ventilator. It includes live data trace plots of pressure and flow, as well as
# calculated values such as tidal volume.
# Copyright (C) 2021 Robert Read, Lauria Clarke, Ben Coombs, and Darío Hereñú.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

from flask import Flask, render_template, request, send_from_directory, jsonify
import serial;
import time;

app = Flask(__name__)

def serial_conn():
    ser = serial.Serial('COM4', 112500, timeout=1)
    print(ser.name)
    ser.flushInput()
    ser.write(b'A')
    time.sleep(0.1)
    #need to wait and read the bytes back properly
    ser_bytes = ser.readline()
    print(ser_bytes)
    #s = ser_bytes.decode('utf-8')
    s = "".join(map(chr, ser_bytes))
    print(s)
    return s


@app.route('/')
def render():
    if 'rr' in request.args:
        a = request.args.get('rr')
        print("rr: " + a)

        b = serial_conn()
        resp = jsonify(success=b)
        resp.status_code = 200
        return resp
    else:
        return "Invalid args", 400


@app.after_request
def add_header(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

if __name__=='__main__':
    app.run(debug=True)
