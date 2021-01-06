int incomingByte = 0; // for incoming serial data

void setup() {
  Serial.begin(112500);
}

void loop() {
  // put your main code here, to run repeatedly:
 // reply only when you receive data:
  if (Serial.available() > 0) {
    // read the incoming byte:
    incomingByte = Serial.read();

    Serial.println(incomingByte, DEC);
  }
}
