#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_Fingerprint.h>
#include <SoftwareSerial.h>
#include <SPI.h>
#include <MFRC522.h>

// -------------------- Pin definitions --------------------
#define ONE_WIRE_BUS 22     // DS18B20
#define RELAY_PIN    4
#define PIR_PIN      2
#define TRIG_PIN     8
#define ECHO_PIN     9
#define SS_PIN       10
#define RST_PIN      11
#define BUZZER_PIN   7
#define LED_R        3
#define LED_G        5
#define LED_B        6
// Fingerprint sensor on Serial1 (RX1=19, TX1=18)

// ----------------------------------------------------------
Adafruit_Fingerprint finger(&Serial1);
#define FINGER_RX    19     // Serial1 RX
#define FINGER_TX    18     // Serial1 TX

// ----------------------------------------------------------
SoftwareSerial fingerSerial(FINGER_RX, FINGER_TX);
MFRC522 rfid(SS_PIN, RST_PIN);
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

String bufferIn;
bool   cmdReady = false;

// Helper to set RGB LED
const bool COMMON_CATHODE = true;
void setRGB(uint8_t r, uint8_t g, uint8_t b) {
  if (COMMON_CATHODE) {
    analogWrite(LED_R, r);
    analogWrite(LED_G, g);
    analogWrite(LED_B, b);
  } else {
    analogWrite(LED_R, 255 - r);
    analogWrite(LED_G, 255 - g);
    analogWrite(LED_B, 255 - b);
  }
}
void rgbOff(){ setRGB(0,0,0); }

void setup() {
  Serial.begin(9600);
  while (!Serial);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  Serial1.begin(57600);
  finger.begin(57600);
  if (!finger.verifyPassword()) Serial.println(F("⚠️ Huella no detectada"));

  SPI.begin();
  rfid.PCD_Init();

  sensors.begin();

  pinMode(PIR_PIN, INPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  rgbOff();

  Serial.println(F("EduSecMega listo"));
}

// ---------------------- Fingerprint -----------------------
uint8_t enrolarHuella(uint8_t id) {
  Serial.println(F("Coloca el dedo..."));
  while (finger.getImage() != FINGERPRINT_OK) {
    if (Serial.available()) return 1; // abort
  }
  if (finger.image2Tz(1) != FINGERPRINT_OK) return 2;
  Serial.println(F("Retira el dedo"));
  delay(2000);
  Serial.println(F("Coloca el mismo dedo de nuevo..."));
  while (finger.getImage() != FINGERPRINT_OK) {
    if (Serial.available()) return 1;
  }
  if (finger.image2Tz(2) != FINGERPRINT_OK) return 3;
  if (finger.createModel() != FINGERPRINT_OK) return 4;
  if (finger.storeModel(id) != FINGERPRINT_OK) return 5;
  return 0;
}

uint8_t borrarHuella(uint8_t id) {
  return finger.deleteModel(id);
}

bool verificarHuella() {
  if (finger.getImage() != FINGERPRINT_OK) return false;
  if (finger.image2Tz() != FINGERPRINT_OK) return false;
  if (finger.fingerFastSearch() != FINGERPRINT_OK) return false;
  return true;
}

// ------------------------ Helpers -------------------------
long leerDistancia() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  return pulseIn(ECHO_PIN, HIGH, 30000);
}

float leerVoltaje() {
  int raw = analogRead(A0);
  return raw * (5.0 / 1023.0);
}

void sonarAlarma() {
  for (int i = 0; i < 3; i++) {
    tone(BUZZER_PIN, 2000, 150);
    delay(200);
  }
  noTone(BUZZER_PIN);
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

  if (cmd == "abrir") {
    digitalWrite(RELAY_PIN, LOW);
    Serial.println(F("Puerta abierta"));
  }
  else if (cmd == "cerrar") {
    digitalWrite(RELAY_PIN, HIGH);
    Serial.println(F("Puerta cerrada"));
  }
  else if (cmd.startsWith("enrolar ")) {
    int id = cmd.substring(8).toInt();
    uint8_t r = enrolarHuella(id);
    if (r == 0) Serial.println(F("Huella enrolada"));
    else Serial.println(F("Error enrolando"));
  }
  else if (cmd.startsWith("borrar ")) {
    int id = cmd.substring(7).toInt();
    if (borrarHuella(id) == FINGERPRINT_OK) Serial.println(F("Huella borrada"));
    else Serial.println(F("Error borrando"));
  }
  else if (cmd == "huella") {
    if (verificarHuella()) Serial.println(F("Huella válida"));
    else Serial.println(F("Huella no válida"));
  }
  else if (cmd == "distancia") {
    long dur = leerDistancia();
    if (dur == 0) Serial.println(F("Distancia: error"));
    else {
      float cm = (dur * 0.034) / 2.0;
      Serial.print(F("Distancia: "));
      Serial.print(cm, 1);
      Serial.println(F(" cm"));
    }
  }
  else if (cmd == "pir") {
    int v = digitalRead(PIR_PIN);
    Serial.print(F("PIR: "));
    Serial.println(v);
  }
  else if (cmd == "rfid") {
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      Serial.print(F("UID: "));
      for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) Serial.print('0');
        Serial.print(rfid.uid.uidByte[i], HEX);
        if (i < rfid.uid.size - 1) Serial.print(':');
      }
      Serial.println();
      rfid.PICC_HaltA();
    } else {
      Serial.println(F("Sin tarjeta"));
    }
  }
  else if (cmd == "voltaje") {
    float v = leerVoltaje();
    Serial.print(F("Voltaje: "));
    Serial.print(v, 2);
    Serial.println(F(" V"));
  }
  else if (cmd == "alarm") {
    sonarAlarma();
    Serial.println(F("Alarma sonó"));
  }
  else if (cmd.startsWith("rgb ")) {
    String c = cmd.substring(4);
    if (c == "red")      setRGB(255,0,0);
    else if (c == "green") setRGB(0,255,0);
    else if (c == "blue")  setRGB(0,0,255);
    else if (c == "off")   rgbOff();
    Serial.println(F("RGB listo"));
  }
  else if (cmd == "leertemp") {
    sensors.requestTemperatures();
    float t = sensors.getTempCByIndex(0);
    if (t == DEVICE_DISCONNECTED_C) {
      Serial.println(F("Error: DS18B20 no conectado"));
    } else {
      Serial.print(F("Temp: "));
      Serial.print(t, 1);
      Serial.println(F(" C"));
    }
  }
  else {
    Serial.println(F("comando no reconocido"));
  }
}
