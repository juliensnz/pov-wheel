#include "FS.h"

#define FASTLED_ESP8266_NODEMCU_PIN_ORDER

#include <FastLED.h>
#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>

const int def = 1;

const char *filePath = "/upload";

const char *ssid = "Wheel";
const char *password = "suckmywheel";
bool connected = false;
File f;

ESP8266WebServer server(80);

WiFiEventHandler stationConnectedHandler;
WiFiEventHandler stationDisconnectedHandler;


void handleHome() {
  File homePage = SPIFFS.open("/index.html", "r");

  if (!homePage) {
    Serial.println("Count file open failed on read.");
    server.send(500);
  } else {
    while(homePage.available()) {
      String file = homePage.readString();
      server.send(200, "text/html", file);
      Serial.println("GET");
    }
    homePage.close();
  }
}

void handleUpload() {
  uint8_t body[server.args()];
  for (int i = 0; i < server.args(); i++) {
    body[i] = server.arg(server.argName(i)).toInt();
  }

  f.write(body, server.args());

  server.send(200);

  float ratio = (float) f.size() / (float) ((360 / def) * 3 * 144);
  displayProgressBar(ratio, 36);
}

void handleOpen() {
  f.close();
  Serial.println("Closed file on read mode");
  f = SPIFFS.open(filePath, "w");
  if (!f) {
    Serial.println("Count file open failed on read.");
    server.send(500);
  }
  Serial.println("Opened file on write mode");

  server.send(200);
}

void handleClose() {
  Serial.println(f.size());
  f.close();
  Serial.println("Closed file on write mode");
  f = SPIFFS.open(filePath, "r");
  if (!f) {
    Serial.println("Count file open failed on read.");
    server.send(500);
  }
  Serial.println("Opened file on read mode");

  server.send(200);
}

/**
 * Here we define where are hoocked up the led strips
 */
#define LED_PIN_0   5
#define LED_PIN_90  6
#define LED_PIN_180 7
#define LED_PIN_240 8

/**
 * Pin number to measure the battery level
 */
int VOLT_PIN =  3;

#define NUM_STRIPS            4        //How much led strip do we have
#define NUM_LEDS_PER_STRIP    36       //Number of leds per strip
#define BRIGHTNESS            15       //Brightness level of the leds
#define LED_TYPE              WS2812B  //Led strip type (list of supported strip here: https://github.com/FastLED/FastLED/wiki/Chipset-reference)
#define COLOR_ORDER           GRB      //Color ordering in the led strip. To find out which color organisation you have, run this: https://github.com/FastLED/FastLED/blob/master/examples/RGBCalibrate/RGBCalibrate.ino

/*
 * We declare the led strips in memory
 */
CRGB leds[NUM_STRIPS * NUM_LEDS_PER_STRIP];

/*
 * Get the battery level in 0 -> 1 value form
 */
float getBatteryLevel(int num_sample, int sensorPin) {
  int sum = 0;                    // sum of samples taken
  unsigned char sample_count = 0; // current sample number
  while (sample_count < num_sample) {
      sum += analogRead(sensorPin);
      sample_count++;
      delay(10);
  }

  return ((((float) sum / (float) num_sample) / 1024.0) * 5 - 3.2) / 1.2;
}

/*
 * Display the battery level on the first strip of led (red dots for empty cells and green for full)
 */
void displayProgressBar(float batteryLevel, int numLeds) {
  for (int i = 0; i < numLeds; i++) {
    const int color = (int) (batteryLevel * (float) numLeds) > i ? 254 : 0;

    leds[i]               = CRGB(color, color, color);
    leds[i + numLeds]     = CRGB(color, color, color);
    leds[i + numLeds * 2] = CRGB(color, color, color);
    leds[i + numLeds * 3] = CRGB(color, color, color);
  }

  FastLED.show();
}

bool magnet = false;
void magnetDetect() {
  magnet = true;
}

int wheelStart = 0;
void setup() {
  attachInterrupt(0, magnetDetect, RISING);

  Serial.begin(9600);
  pinMode(VOLT_PIN, INPUT);
  delay(1000); // power-up safety delay

  Serial.println("Starting of the board");

  Serial.print("Configuring access point...");
  /* You can remove the password parameter if you want the AP to be open. */
  WiFi.softAP(ssid, password);

  stationConnectedHandler = WiFi.onSoftAPModeStationConnected(&onStationConnected);
  stationDisconnectedHandler = WiFi.onSoftAPModeStationDisconnected(&onStationDisconnected);

  IPAddress myIP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(myIP);
  server.on("/", HTTP_GET, handleHome);
  server.on("/open", HTTP_POST, handleOpen);
  server.on("/upload", HTTP_POST, handleUpload);
  server.on("/close", HTTP_POST, handleClose);
  server.begin();
  Serial.println("HTTP server started");

  FastLED.addLeds<LED_TYPE, LED_PIN_0,   COLOR_ORDER>(leds, 0 * NUM_LEDS_PER_STRIP, NUM_LEDS_PER_STRIP).setCorrection( TypicalLEDStrip );
  FastLED.addLeds<LED_TYPE, LED_PIN_90,  COLOR_ORDER>(leds, 1 * NUM_LEDS_PER_STRIP, NUM_LEDS_PER_STRIP).setCorrection( TypicalLEDStrip );
  FastLED.addLeds<LED_TYPE, LED_PIN_180, COLOR_ORDER>(leds, 2 * NUM_LEDS_PER_STRIP, NUM_LEDS_PER_STRIP).setCorrection( TypicalLEDStrip );
  FastLED.addLeds<LED_TYPE, LED_PIN_240, COLOR_ORDER>(leds, 3 * NUM_LEDS_PER_STRIP, NUM_LEDS_PER_STRIP).setCorrection( TypicalLEDStrip );
  FastLED.setBrightness(BRIGHTNESS);
  Serial.println("Led initialized");

  Serial.println("Display of the battery level");
  displayProgressBar(getBatteryLevel(10, VOLT_PIN), NUM_LEDS_PER_STRIP);
  delay(2000); // power-up safety delay

  SPIFFS.begin();
  f = SPIFFS.open(filePath, "r");
  Serial.println(f);
  if (!f) {
    Serial.println("Count file open failed on read.");
  }

  wheelStart = millis();
}

int timeForARevolution = 36000000;
int angle;
int NUM_LEDS = NUM_STRIPS * NUM_LEDS_PER_STRIP;
int maxAngle = (int) (360/def);
char buffer[432];

void loop() {
  if (connected) {
    server.handleClient();

    return;
  }

  if (magnet) {
    timeForARevolution =  millis() - wheelStart;
    wheelStart = millis();
    magnet = false;
  }
  angle = ((int) ((((float) (millis() - wheelStart) / timeForARevolution)) * (float) maxAngle)) % maxAngle;

  f.seek(sizeof(leds)*angle, SeekSet);
  f.readBytes((char*)leds, sizeof(leds));

  FastLED.show();
}

void onStationConnected(const WiFiEventSoftAPModeStationConnected& evt) {
  connected = true;
  Serial.print("Station connected: ");
  Serial.println(macToString(evt.mac));
}

void onStationDisconnected(const WiFiEventSoftAPModeStationDisconnected& evt) {
  connected = false;
  Serial.print("Station disconnected: ");
  Serial.println(macToString(evt.mac));
}

String macToString(const unsigned char* mac) {
  char buf[20];
  snprintf(buf, sizeof(buf), "%02x:%02x:%02x:%02x:%02x:%02x",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}
