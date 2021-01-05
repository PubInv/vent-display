from flask import Flask, render_template;
import serial;
import time;

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('breath_plot.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')

#ser = serial.Serial('COM4', 112500, timeout=1)
#print(ser.name)
#ser.flushInput()

#while True:
#    try:
#        ser.write(b'A')
#        time.sleep(0.1)
#        ser_bytes = ser.readline()
#        print(ser_bytes)
#    except KeyboardInterrupt:
#        print("Keyboard Interrupt")
#        break
