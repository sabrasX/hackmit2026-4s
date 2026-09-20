#include <Arduino_RouterBridge.h>
#include <Wire.h>
#include "MAX30105.h"

MAX30105 particleSensor;
long ir[5];
long red[5];
int n = 0;

void setup() {
  Bridge.begin();
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    while (1);
  }
  particleSensor.setup(0x24, 1, 2, 50, 411, 4096);
}

void loop() {
  particleSensor.check();
  while (particleSensor.available()) {
    ir[n] = particleSensor.getFIFOIR();
    red[n] = particleSensor.getFIFORed();
    particleSensor.nextSample();
    n++;
    if (n == 5) {
      Bridge.notify("samples", ir[0], red[0], ir[1], red[1], ir[2], red[2],
                    ir[3], red[3], ir[4], red[4]);
      n = 0;
    }
  }
}