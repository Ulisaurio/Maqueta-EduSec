#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_Fingerprint.h>
#include <SPI.h>
#include <MFRC522.h>

// -------------------- Pin definitions --------------------
#define ONE_WIRE_BUS 22     // DS18B20
#define RELAY_PIN    4
#define PIR_PIN      2
#define TRIG_PIN     8
#define ECHO_PIN     5
#define SDA_PIN      10          // SS
#define RST_PIN      9           // Reset
#define BUZZER_PIN   7
#define LED_R        3
#define LED_G        44          // PWM safe on Mega
#define LED_B        6
// Fingerprint sensor on Serial1 (TX sensor→19, RX sensor←18, 5V)

// ----------------------------------------------------------
Adafruit_Fingerprint finger(&Serial1);  // uses hardware Serial1
MFRC522 rfid(SDA_PIN, RST_PIN);
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

#define CMD_BUF_SIZE 64
char    cmdBuffer[CMD_BUF_SIZE];

// Flags set after detecting each peripheral during setup()
bool    fingerPresent = false;
bool    rfidPresent   = false;

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
  Serial.setTimeout(10); // short timeout for readBytesUntil

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  Serial1.begin(57600);
  delay(200);               // allow sensor to power up
  finger.begin(57600);
  for (uint8_t i = 0; i < 3 && !fingerPresent; i++) {
    fingerPresent = finger.verifyPassword();
    if (!fingerPresent) delay(200);
  }
  if (fingerPresent) {
    Serial.println(F("🟢 Sensor de huella detectado"));
  } else {
    Serial.println(F("🔴 Sensor de huella NO detectado"));
  }

  SPI.begin();
  rfid.PCD_Init();
  Serial.println(F("🟢 RFID iniciado"));
  rfidPresent = true;

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
  if (!fingerPresent) return false;
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


void sonarAlarma() {
  for (int i = 0; i < 3; i++) {
    tone(BUZZER_PIN, 2000, 150);
    delay(200);
  }
  noTone(BUZZER_PIN);
}

void loop() {
  if (!Serial.available()) return;

  size_t len = Serial.readBytesUntil('\n', cmdBuffer, CMD_BUF_SIZE - 1);
  cmdBuffer[len] = '\0';
  if (len > 0 && cmdBuffer[len - 1] == '\r') cmdBuffer[len - 1] = '\0';

  char *cmd = cmdBuffer;
  while (*cmd == ' ' || *cmd == '\t') cmd++;
  size_t end = strlen(cmd);
  while (end > 0 && (cmd[end - 1] == ' ' || cmd[end - 1] == '\t')) {
    cmd[--end] = '\0';
  }

  if (strcmp(cmd, "abrir") == 0) {
    digitalWrite(RELAY_PIN, LOW);
    Serial.println(F("Acceso principal abierto"));
  }
  else if (strcmp(cmd, "cerrar") == 0) {
    digitalWrite(RELAY_PIN, HIGH);
    Serial.println(F("Acceso principal cerrado"));
  }
  else if (strncmp(cmd, "enrolar ", 8) == 0) {
    if (!fingerPresent) {
      Serial.println(F("Sensor de huella no disponible"));
    } else {
      int id = atoi(cmd + 8);
      uint8_t r = enrolarHuella(id);
      if (r == 0) Serial.println(F("Huella enrolada"));
      else Serial.println(F("Error enrolando"));
    }
  }
  else if (strncmp(cmd, "borrar ", 7) == 0) {
    if (!fingerPresent) {
      Serial.println(F("Sensor de huella no disponible"));
    } else {
      int id = atoi(cmd + 7);
      if (borrarHuella(id) == FINGERPRINT_OK) Serial.println(F("Huella borrada"));
      else Serial.println(F("Error borrando"));
    }
  }
  else if (strcmp(cmd, "huella") == 0) {
    if (!fingerPresent) Serial.println(F("Sensor de huella no disponible"));
    else if (verificarHuella()) Serial.println(F("Huella válida"));
    else Serial.println(F("Huella no válida"));
  }
  else if (strcmp(cmd, "distancia") == 0) {
    long dur = leerDistancia();
    if (dur == 0) Serial.println(F("Distancia: error"));
    else {
      float cm = (dur * 0.034) / 2.0;
      Serial.print(F("Distancia: "));
      Serial.print(cm, 1);
      Serial.println(F(" cm"));
    }
  }
  else if (strcmp(cmd, "pir") == 0) {
    int v = digitalRead(PIR_PIN);
    Serial.print(F("PIR: "));
    Serial.println(v);
  }
  else if (strcmp(cmd, "rfid") == 0) {
    if (!rfidPresent) {
      Serial.println(F("RFID no disponible"));
    }
    else if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
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
  else if (strcmp(cmd, "listar_huellas") == 0) {
    String listado = "";
    for (uint16_t i = 1; i <= 200; i++) {
      if (finger.loadModel(i) == FINGERPRINT_OK) {
        if (listado.length() > 0) listado += ',';
        listado += String(i);
      }
    }
    Serial.println(listado);
  }
  else if (strcmp(cmd, "buzzer_status") == 0) {
    Serial.println(F("Buzzer listo"));
  }
  else if (strcmp(cmd, "alarm") == 0) {
    sonarAlarma();
    Serial.println(F("Alarma sonó"));
  }
  else if (strncmp(cmd, "rgb ", 4) == 0) {
    const char *c = cmd + 4;
    if (strcmp(c, "red") == 0)      { setRGB(255,0,0); Serial.println("RGB listo"); }
    else if (strcmp(c, "green") == 0){ setRGB(0,255,0); Serial.println("RGB listo"); }
    else if (strcmp(c, "blue") == 0) { setRGB(0,0,255); Serial.println("RGB listo"); }
    else if (strcmp(c, "off") == 0)  { rgbOff(); Serial.println("RGB listo"); }
    else Serial.println(F("rgb inválido"));
  }
  else if (strcmp(cmd, "leertemp") == 0) {
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
