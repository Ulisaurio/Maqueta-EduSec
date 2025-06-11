#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_Fingerprint.h>
#include <SoftwareSerial.h>

#define ONE_WIRE_BUS 5
#define RELAY_PIN 4
#define FINGER_RX 2
#define FINGER_TX 3

SoftwareSerial fingerSerial(FINGER_RX, FINGER_TX);
Adafruit_Fingerprint finger(&fingerSerial);

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

String bufferIn;
bool cmdReady = false;

void setup() {
  Serial.begin(9600);
  while (!Serial);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  fingerSerial.begin(57600);
  finger.begin(57600);
  if (!finger.verifyPassword()) Serial.println("\xE2\x9A\xA0\xEF\xB8\x8F Huella no detectada");

  sensors.begin();
  Serial.println("A1 listo: 'leertemp','abrir','cerrar','huella'");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') { cmdReady = true; break; }
    bufferIn += c;
  }
  if (!cmdReady) return;

  String cmd = bufferIn;
  cmd.trim();
  bufferIn = "";
  cmdReady = false;

  if (cmd.equalsIgnoreCase("leertemp")) {
    sensors.requestTemperatures();
    float t = sensors.getTempCByIndex(0);
    if (t == DEVICE_DISCONNECTED_C) {
      Serial.println("Error: DS18B20 no conectado");
    } else {
      Serial.print("\xF0\x9F\x8C\xA1\xEF\xB8\x8F Temp: ");
      Serial.print(t, 1);
      Serial.println(" \xC2\xB0C");
    }
    return;
  }

  if (cmd.equalsIgnoreCase("abrir")) {
    digitalWrite(RELAY_PIN, LOW);
    Serial.println("Acceso principal abierto");
    return;
  }
  if (cmd.equalsIgnoreCase("cerrar")) {
    digitalWrite(RELAY_PIN, HIGH);
    Serial.println("Acceso principal cerrado");
    return;
  }

  if (cmd.equalsIgnoreCase("huella")) {
    if (finger.getImage() == FINGERPRINT_OK &&
        finger.image2Tz() == FINGERPRINT_OK &&
        finger.fingerFastSearch() == FINGERPRINT_OK) {
      Serial.println("Huella válida");
    } else {
      Serial.println("Huella no válida");
    }
    return;
  }
}
