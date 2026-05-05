# Proyecto Legacy: Casino Management System

## Project Overview
This project is a centralized management system for casino slot machines. It consists of two main components:
1.  **Master Controller (`lecacy/maestro.py`)**: A Python-based application using Flask for a web interface and Sockets/UDP for communication with slave devices. It manages transactions, users, slot machine logs, and backups.
2.  **ESP32 Firmware (`firm_esp32/SLAVE_16_04_26.ino`)**: C++ firmware for ESP32 microcontrollers that act as "slaves". These devices communicate with slot machines using the SAS (Slot Accounting System) protocol and report back to the Master Controller via WiFi (TCP/UDP).

### Main Technologies
-   **Backend**: Python 3, Flask, SQLite3, Sockets (TCP/UDP).
-   **Firmware**: C++ (Arduino/ESP32 Framework), SAS Protocol, WiFi, OTA (Over-the-Air) updates.
-   **Data Storage**: SQLite (`casino_data.db`), Excel (`.xlsx`) for reports/logs, and JSON for configuration.
-   **Frontend**: HTML/CSS (Vanilla) and JavaScript.

### Architecture
-   **Master-Slave Model**: The Master acts as a server (Flask web server on port 5000, UDP/TCP socket server on port 8081/8080).
-   **Communication**: Slaves broadcast their presence via UDP beacons. The Master accepts connections and manages data flow.
-   **Concurrency**: Uses `threading.RLock` to manage database access between the web interface and socket threads.

---

## Building and Running

### Master Controller
1.  **Environment Setup**:
    -   Install dependencies: `pip install flask openpyxl python-dotenv werkzeug`.
    -   Create a `.env` file based on the logic in `maestro.py` (PUERTO_WEB, PUERTO_UDP, MAX_CLIENTS, DB_NAME, FLASK_SECRET_KEY).
2.  **Running**:
    -   Execute `python maestro.py` from the `lecacy` directory.
    -   Access the web interface at `http://localhost:5000` (default).

### ESP32 Firmware
1.  **Setup**:
    -   Use Arduino IDE or PlatformIO with ESP32 support.
    -   Configure WiFi credentials (`ssid`, `password`) in `SLAVE_16_04_26.ino`.
2.  **Flashing**:
    -   Upload to ESP32 via USB or OTA if already deployed.

---

## Development Conventions

### Coding Style
-   **Python**: Follows a procedural-heavy style within `maestro.py`. Uses manual environment variable loading.
-   **Firmware**: Uses dual-core tasks (FreeRTOS) on ESP32 (e.g., `tareaRed` on Core 0).

### Key Files & Directories
-   `lecacy/maestro.py`: Main entry point for the controller.
-   `lecacy/casino_data.db`: Main SQLite database.
-   `lecacy/backups/`: Automated database backups.
-   `lecacy/templates/` & `lecacy/static/`: Web interface assets.
-   `firm_esp32/SLAVE_16_04_26.ino`: Slave firmware logic.
-   `lecacy/Log_*.xlsx`: Activity logs and accounting reports.

### Security
-   **Roles**: admin, supervisor, operador, consulta.
-   **Limits**: Transaction limits are enforced based on user roles (`MAX_MONTO_ROL`, `MAX_DIARIO_ROL`).
-   **Sessions**: Managed via Flask sessions with a configurable timeout.

---

## Usage
-   **Monitoring**: Real-time status of slot machines (uptime, firmware version, last error).
-   **Transactions**: Recording and auditing of monetary loads/discharges.
-   **Reporting**: Generation of Excel reports for auditing and accounting.
-   **SAS Protocol**: Handling of SAS events (General Poll, Meters, Handpays) from slot machines.
