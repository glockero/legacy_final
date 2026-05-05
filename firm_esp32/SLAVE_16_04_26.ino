// ====================================================================
// ESCLAVO SAS - (WATCHDOG INVERSO, DICCIONARIO COMPLETO, CONTADORES Y OTA)
// ====================================================================
#include <HardwareSerial.h>
#include <driver/uart.h>
#include <WiFi.h>
#include <WiFiServer.h>
#include <WiFiClient.h>
#include <WiFiUdp.h>

// --- NUEVO: Librerías para OTA ---
#include <ESPmDNS.h>
#include <ArduinoOTA.h>
// ---------------------------------

const char* ssid = "Pasillo_1";
const char* password = "laboratorio_2024_$$";

const uint16_t puertoTCP = 8080;
const uint16_t puertoUDP = 8081; 

WiFiServer serverLocal(puertoTCP); 
WiFiClient clienteMaestro;
WiFiUDP udp; 

// ====================================================================
String assetID = "SLOT_002"; // TU ID MANUAL AQUÍ
// ====================================================================

volatile bool maestroConectado = false;
volatile bool hayComandoRed = false;
String comandoRedBuffer = "";
volatile unsigned long ultimoMensajeSAS = 0; 

#define RXD2 16
#define TXD2 17

const uint8_t EGM_ADDRESS = 0x01; 
const uint8_t GENERAL_POLL = EGM_ADDRESS | 0x80; 
const uint8_t SYNC_BYTE = 0x80; 
const double ACCOUNTING_DENOM = 0.01; 

void processHighRollerBonus(double montoOriginal);
void sendSasMessage(uint8_t* data, uint8_t length);
void sendSasByte(uint8_t b, bool isWakeup);
uint16_t calculateCRC(uint8_t* data, uint8_t length);
void enviarLog(String mensaje);
void queryMeters();
String readSingleMeter(uint8_t cmdPoll);

// ====================================================================
// NÚCLEO 0: RED, WATCHDOG Y OTA
// ====================================================================
void tareaRed(void * parameter) {
  serverLocal.begin(); 
  unsigned long ultimoBeacon = 0;
  unsigned long ultimoContactoMaestro = millis(); 
  
  for(;;) {
    if (WiFi.status() != WL_CONNECTED) {
      if (maestroConectado) maestroConectado = false;
      vTaskDelay(2000 / portTICK_PERIOD_MS);
      continue;
    }

    // --- NUEVO: Manejo de OTA en la tarea de red ---
    ArduinoOTA.handle();
    // -----------------------------------------------

    if (maestroConectado && (millis() - ultimoContactoMaestro > 12000)) {
       Serial.println("[-] Timeout: El Maestro desaparecio. Reiniciando socket...");
       clienteMaestro.stop(); 
       maestroConectado = false;
    }

    if ((!clienteMaestro || !clienteMaestro.connected()) && (millis() - ultimoBeacon > 3000)) {
      udp.beginPacket(IPAddress(255, 255, 255, 255), puertoUDP);
      udp.print("SAS_BEACON|" + assetID);
      udp.endPacket();
      ultimoBeacon = millis();
    }

    if (!clienteMaestro || !clienteMaestro.connected()) {
      maestroConectado = false;
      clienteMaestro = serverLocal.available(); 
      if (clienteMaestro) {
        clienteMaestro.println("REGISTRO|" + assetID + "|" + WiFi.macAddress()); 
        maestroConectado = true;
        ultimoContactoMaestro = millis(); 
      }
    } else {
      maestroConectado = true;
      if (clienteMaestro.available()) {
        ultimoContactoMaestro = millis(); 
        
        String cmdTemp = clienteMaestro.readStringUntil('\n');
        cmdTemp.trim();
        
        if (cmdTemp.equalsIgnoreCase("PING")) {
          // Verifica si la máquina nos habló en los últimos 5 segundos (Sensor SAS)
          bool sasOnline = (millis() - ultimoMensajeSAS) < 5000;
          if (sasOnline) {
             clienteMaestro.println("PONG|1"); 
          } else {
             clienteMaestro.println("PONG|0"); 
          }
        } 
        else if (cmdTemp.length() > 0) {
          if (!hayComandoRed) { 
            comandoRedBuffer = cmdTemp;
            hayComandoRed = true;
          } else {
            clienteMaestro.println("ID:" + assetID + "|[!] Sistema ocupado procesando la inyeccion anterior.");
          }
        }
      }
    }
    vTaskDelay(20 / portTICK_PERIOD_MS);
  }
}

void enviarLog(String mensaje) {
  Serial.println(mensaje); 
  if (maestroConectado) {
    clienteMaestro.println("ID:" + assetID + "|" + mensaje);
  }
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(19200, SERIAL_8E1, RXD2, TXD2);

  Serial.println("\n=======================================================");
  Serial.println(" ESCLAVO SAS - ID MANUAL: " + assetID);
  Serial.println("=======================================================");
  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(1000);
  WiFi.setSleep(false); 

  Serial.println("[i] Conectando a Wi-Fi...");
  WiFi.begin(ssid, password);
  
  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
    intentos++;
    if (intentos > 20) {
      WiFi.reconnect();
      intentos = 0;
    }
  }
  WiFi.scanDelete();

  Serial.println("\n[+] WI-FI CONECTADO: " + WiFi.localIP().toString());

  // --- NUEVO: Configuración e Inicio de OTA ---
  ArduinoOTA.setHostname(("SAS_" + assetID).c_str()); // El nombre que aparecerá en la red (ej: SAS_SLOT_001)
  
  ArduinoOTA.onStart([]() {
    String type;
    if (ArduinoOTA.getCommand() == U_FLASH) {
      type = "sketch";
    } else { // U_SPIFFS
      type = "filesystem";
    }
    Serial.println("\n[i] Iniciando actualizacion OTA: " + type);
  });
  
  ArduinoOTA.onEnd([]() {
    Serial.println("\n[+] Actualizacion OTA finalizada exitosamente.");
  });
  
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("[i] Progreso OTA: %u%%\r", (progress / (total / 100)));
  });
  
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("\n[-] Error OTA [%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("Fallo de Autenticacion");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Fallo al Iniciar");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Fallo de Conexion");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Fallo de Recepcion");
    else if (error == OTA_END_ERROR) Serial.println("Fallo al Finalizar");
  });

  ArduinoOTA.begin();
  Serial.println("[+] Servicio OTA iniciado y en espera...");
  // --------------------------------------------

  // Iniciar el núcleo 0
  xTaskCreatePinnedToCore(tareaRed, "TareaRed", 8192, NULL, 1, NULL, 0);
}

void loop() {
  if (hayComandoRed) {
    String cmdLocal = comandoRedBuffer; 
    cmdLocal.trim();
    
    if (cmdLocal.equalsIgnoreCase("METERS")) {
      queryMeters(); 
    } else {
      double monto = cmdLocal.toDouble();
      if (monto > 0) {
        enviarLog("[i] Comando de inyeccion: $" + String(monto));
        processHighRollerBonus(monto);
      }
    }
    hayComandoRed = false; 
  }

  sendSasByte(SYNC_BYTE, true); delay(5); 
  sendSasByte(GENERAL_POLL, true); delay(10); 
  
  while (Serial2.available()) { 
    uint8_t rx = Serial2.read(); 
    ultimoMensajeSAS = millis(); // Registra latido SAS

    if (rx != GENERAL_POLL && rx != EGM_ADDRESS && rx != SYNC_BYTE && rx != 0xFF && rx != 0x00 && rx != 0x1F) {
      switch(rx) {
        case 0x11: enviarLog("[-] ALERTA: Puerta Principal Abierta"); break;
        case 0x12: enviarLog("[+] INFO: Puerta Principal Cerrada"); break;
        case 0x13: enviarLog("[-] ALERTA: Puerta de Caja Abierta (Drop Door)"); break;
        case 0x14: enviarLog("[+] INFO: Puerta de Caja Cerrada"); break;
        case 0x15: enviarLog("[-] ALERTA: Puerta de Lógica Abierta (Card Cage)"); break;
        case 0x16: enviarLog("[+] INFO: Puerta de Lógica Cerrada"); break;
        case 0x17: enviarLog("[+] INFO: Máquina Encendida (AC Power Applied)"); break;
        case 0x18: enviarLog("[-] ERROR: Corte de Energía Registrado (AC Power Lost)"); break;
        case 0x19: enviarLog("[-] ALERTA: Puerta de Billetero Abierta"); break;
        case 0x1A: enviarLog("[+] INFO: Puerta de Billetero Cerrada"); break;
        case 0x1B: enviarLog("[-] ALERTA: Billetero Extraído"); break;
        case 0x1C: enviarLog("[+] INFO: Billetero Insertado"); break;
        case 0x1D: enviarLog("[-] ALERTA: Puerta Inferior Abierta (Belly Door)"); break;
        case 0x1E: enviarLog("[+] INFO: Puerta Inferior Cerrada"); break;
        case 0x20: enviarLog("[-] ERROR: TILT General"); break;
        case 0x21: enviarLog("[-] ERROR: TILT Monedero Entrada (Coin In)"); break;
        case 0x22: enviarLog("[-] ERROR: TILT Monedero Salida (Coin Out)"); break;
        case 0x23: enviarLog("[-] ERROR: Hopper Vacío"); break;
        case 0x24: enviarLog("[-] ERROR: Moneda Extra Pagada"); break;
        case 0x25: enviarLog("[-] ERROR: Falla en Desviador (Diverter)"); break;
        case 0x27: enviarLog("[-] ALERTA: Caja de Billetero Llena"); break;
        case 0x28: enviarLog("[-] ERROR: Billete Atascado (Bill Jam)"); break;
        case 0x29: enviarLog("[-] ERROR: Falla de Hardware del Billetero"); break;
        case 0x2A: enviarLog("[-] ALERTA: Billete Invertido"); break;
        case 0x2B: enviarLog("[-] ALERTA: Billete Rechazado"); break;
        case 0x2C: enviarLog("[-] ALERTA: Billete Falso Detectado"); break;
        case 0x47: case 0x48: case 0x49: case 0x4A: case 0x4B: case 0x4C: case 0x4D: case 0x4E: case 0x4F: case 0x50:
                   enviarLog("[+] DINERO: Billete Aceptado"); break;
        case 0x51: enviarLog("[-] ALERTA: Handpay Pendiente / Pago Manual"); break;
        case 0x55: enviarLog("[-] ERROR: Falla de Impresora de Tickets"); break;
        case 0x56: enviarLog("[+] INFO: Ticket Impreso Exitosamente"); break;
        case 0x66: enviarLog("[+] INFO: Botón Cash Out Presionado"); break;
        case 0x68: enviarLog("[+] INFO: Ticket Aceptado (TITO)"); break;
        case 0x7C: enviarLog("[+] NOTIFICACIÓN: Créditos de bono registrados (0x7C)"); break;
        default: break; 
      }
    }
  }
  delay(50); 
}

// ====================================================================
// LECTURA ROBUSTA DE CONTADORES UNIVERSALES (Standard Long Polls)
// ====================================================================
String readSingleMeter(uint8_t cmdPoll) {
  uint8_t cmd[] = {EGM_ADDRESS, cmdPoll};
  sendSasMessage(cmd, 2);
  
  uint32_t tAck = millis();
  uint8_t buf[40];
  int idx = 0;
  
  // Espera hasta 400ms por la respuesta
  while((millis() - tAck) < 400) {
    while(Serial2.available() && idx < 40) {
      buf[idx++] = Serial2.read();
      ultimoMensajeSAS = millis(); // Confirma que la máquina respondió
    }
    
    if (idx >= 8) {
      // Busca la firma de respuesta ignorando posibles ecos del hardware
      for(int i = 0; i <= idx - 8; i++) {
        if (buf[i] == EGM_ADDRESS && buf[i+1] == cmdPoll) {
          uint16_t crcCalc = calculateCRC(&buf[i], 6);
          uint16_t crcRx = buf[i+6] | (buf[i+7] << 8);
          
          if (crcCalc == crcRx) {
            String valStr = "";
            for(int j = 2; j < 6; j++) {
              char hex[3];
              sprintf(hex, "%02X", buf[i+j]);
              valStr += hex;
            }
            // Elimina los ceros a la izquierda para limpiar la pantalla
            int firstNonZero = 0;
            while(firstNonZero < (int)valStr.length()-1 && valStr[firstNonZero] == '0') {
              firstNonZero++;
            }
            return valStr.substring(firstNonZero);
          }
        }
      }
    }
    delay(10);
  }
  return "-"; // Falla al leer este contador específico
}

void queryMeters() {
  String out = "METERS|";
  out += "In:" + readSingleMeter(0x11) + " ";   // Total Coin In
  out += "Out:" + readSingleMeter(0x12) + " ";  // Total Coin Out
  out += "Drop:" + readSingleMeter(0x13) + " "; // Total Drop
  out += "Canc:" + readSingleMeter(0x15) + " "; // Total Cancelled Credits
  out += "Cred:" + readSingleMeter(0x1A) + " "; // Current Credits
  enviarLog(out);
}

// ====================================================================
// RUTINA DE INYECCIÓN DE CRÉDITOS
// ====================================================================
void processHighRollerBonus(double montoOriginal) {
  uint64_t unidadesTotales = (uint64_t)(montoOriginal / ACCOUNTING_DENOM + 0.5);
  uint32_t limiteLote = 99999900; 
  int nLote = 1;
  bool cancelado = false;

  while (unidadesTotales > 0 && !cancelado) {
    uint32_t tCiclo = millis(); 
    uint32_t unidadesLote = (unidadesTotales > limiteLote) ? limiteLote : (uint32_t)unidadesTotales;
    
    enviarLog("\n[Lote " + String(nLote) + "] Enviando $" + String((double)unidadesLote * ACCOUNTING_DENOM));

    uint8_t bcd[4];
    uint32_t val = unidadesLote;
    for (int i = 3; i >= 0; i--) {
      bcd[i] = ((val / 10 % 10) << 4) | (val % 10);
      val /= 100;
    }

    uint8_t cmd8A[7] = {EGM_ADDRESS, 0x8A, bcd[0], bcd[1], bcd[2], bcd[3], 0x00};
    sendSasMessage(cmd8A, 7);

    uint32_t tAck = millis(); bool ack = false;
    while((millis() - tAck) < 300) {
      while (Serial2.available()) {
        ultimoMensajeSAS = millis(); 
        if (Serial2.read() == EGM_ADDRESS) { ack = true; break; }
      }
      if (ack) break;
    }

    if (!ack) {
      enviarLog("    [X] ERROR: Sin ACK de la maquina.");
      cancelado = true; break;
    }

    bool v7C = false;
    uint32_t t7C = millis();
    while ((millis() - t7C) < 5000 && !v7C) {
      sendSasByte(SYNC_BYTE, true); delay(5); 
      sendSasByte(GENERAL_POLL, true); delay(10);
      while (Serial2.available()) { 
        uint8_t ev = Serial2.read();
        ultimoMensajeSAS = millis(); 
        if (ev == 0x7C) {
          v7C = true;
          enviarLog("    [+] CONFIRMADO: Bono registrado (0x7C).");
        } else if (ev == 0x51) {
          enviarLog("    [!] BLOQUEO: Límite de créditos superado.");
          cancelado = true;
        }
      }
      delay(50);
    }
    
    if (!v7C && !cancelado) { 
      enviarLog("    [X] TIMEOUT: No se recibio 0x7C.");
      cancelado = true; 
    }
    
    unidadesTotales -= unidadesLote;
    nLote++;

    if (unidadesTotales > 0 && !cancelado) {
      uint32_t transcurrido = millis() - tCiclo;
      if (transcurrido < 2500) {
        uint32_t espera = 2500 - transcurrido;
        uint32_t tw = millis();
        while((millis() - tw) < espera) {
          sendSasByte(SYNC_BYTE, true); delay(5); 
          sendSasByte(GENERAL_POLL, true); delay(10);
          while(Serial2.available()) { Serial2.read(); ultimoMensajeSAS = millis(); }
          delay(100);
        }
      }
    }
  }
}

void sendSasMessage(uint8_t* data, uint8_t length) {
  while(Serial2.available()) { Serial2.read(); ultimoMensajeSAS = millis(); }
  uint16_t crc = calculateCRC(data, length);
  sendSasByte(data[0], true); 
  for (uint8_t i = 1; i < length; i++) sendSasByte(data[i], false);
  sendSasByte(crc & 0xFF, false);
  sendSasByte((crc >> 8) & 0xFF, false);
}

void sendSasByte(uint8_t b, bool isWakeup) {
  uint8_t ones = 0;
  for (int i = 0; i < 8; i++) if ((b >> i) & 0x01) ones++;
  bool isEven = (ones % 2 == 0);
  uart_set_parity(UART_NUM_2, (isWakeup ? (isEven ? UART_PARITY_ODD : UART_PARITY_EVEN) : (isEven ? UART_PARITY_EVEN : UART_PARITY_ODD))); 
  Serial2.write(b); Serial2.flush(); 
}

uint16_t calculateCRC(uint8_t* data, uint8_t length) {
  uint16_t crc = 0x0000;
  for (uint8_t i = 0; i < length; i++) {
    crc ^= data[i];
    for (uint8_t j = 0; j < 8; j++) {
      if (crc & 0x0001) crc = (crc >> 1) ^ 0x8408;
      else crc >>= 1;
    }
  }
  return crc;
}