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

