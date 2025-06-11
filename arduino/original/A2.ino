/* A2 – Nivel Superior (protoboard corregido)
   ------------------------------------------
   • PIR en D5
   • Ultrasonido: TRIG→D8, ECHO→D4
   • RFID RC522: SDA=D10, RST=D9, MOSI=D11, MISO=D12, SCK=D13, VCC=3.3V, GND
   • Buzzer pasivo en D7 (directo al pin, sin resistencia)
   • LED RGB (cátodo común) en R→D3, G→D5, B→D6, "-"→GND
*/

#include <SPI.h>
#include <MFRC522.h>

const int PIR_PIN    = 2;
const int TRIG_PIN   = 8;
const int ECHO_PIN   = 4;

const int SDA_PIN    = 10;
const int RST_PIN    = 9;
MFRC522 rfid(SDA_PIN, RST_PIN);

const int BUZZER_PIN = 7;
const int LED_R      = 3;
const int LED_G      = 5;
const int LED_B      = 6;

const bool COMMON_CATHODE = true;

String cmd;
bool   ready = false;

void setup() {
  Serial.begin(9600);
  while (!Serial);

  pinMode(PIR_PIN, INPUT);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  SPI.begin();
  rfid.PCD_Init();

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  rgbOff();

  Serial.println("A2 listo. Comandos: pir, ultra, rfid, alarm, rgb red/green/blue/off");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') { ready = true; break; }
    cmd += c;
  }
  if (!ready) return;
  cmd.trim();
  cmd.toLowerCase();
  ready = false;

  if (cmd == "pir") {
    int v = digitalRead(PIR_PIN);
    Serial.print("PIR: ");
    Serial.println(v);
  }
  else if (cmd == "ultra") {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    long dur = pulseIn(ECHO_PIN, HIGH, 30000);
    if (dur == 0) Serial.println("Distancia: error");
    else {
      float cm = (dur * 0.034) / 2.0;
      Serial.print("Distancia: ");
      Serial.print(cm, 1);
      Serial.println(" cm");
    }
  }
  else if (cmd == "rfid") {
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      Serial.print("UID: ");
      for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) Serial.print('0');
        Serial.print(rfid.uid.uidByte[i], HEX);
        if (i < rfid.uid.size - 1) Serial.print(':');
      }
      Serial.println();
      rfid.PICC_HaltA();
    } else {
      Serial.println("Sin tarjeta");
    }
  }
  else if (cmd == "alarm") {
    for (int i = 0; i < 3; i++) {
      tone(BUZZER_PIN, 2000, 150);
      delay(200);
    }
    noTone(BUZZER_PIN);
    Serial.println("Alarma sonó");
  }
  else if (cmd.startsWith("rgb ")) {
    String c = cmd.substring(4);
    if (c == "red")      rgbRed();
    else if (c == "green") rgbGreen();
    else if (c == "blue")  rgbBlue();
    else if (c == "off")   rgbOff();
    else Serial.println("rgb inválido");
  }
  else {
    Serial.println("comando no reconocido");
  }

  cmd = "";
}

void rgbOff() {
  setRGB(0,0,0);
  Serial.println("RGB off");
}
void rgbRed() {
  setRGB(255,0,0);
  Serial.println("RGB red");
}
void rgbGreen() {
  setRGB(0,255,0);
  Serial.println("RGB green");
}
void rgbBlue() {
  setRGB(0,0,255);
  Serial.println("RGB blue");
}

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
