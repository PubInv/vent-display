const byte DATA_MAX_SIZE = 32;
char data[DATA_MAX_SIZE];
static char endMarker = '\n'; // message separator
char c;

void setup() {
  Serial.begin(9600);
  memset(data, 33, sizeof(data)); 
}

void loop() {
  if (Serial.available() > 0){
    c = Serial.read();
    Serial.print(c); 
  }
}
