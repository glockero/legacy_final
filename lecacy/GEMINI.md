# Proyecto Legacy: Master Controller (`lecacy/`)

## Project Overview
This directory contains the **Master Controller** for the Casino Management System. It is a Python-based application designed to run on a Raspberry Pi (or similar Linux environment) to manage and monitor casino slot machines ("slaves") in real-time.

### Core Functions
-   **Web Dashboard**: A Flask-based interface for operators and administrators to monitor machine status, perform credit loads, and view transaction history.
-   **Communication Engine**: Uses TCP/UDP sockets to communicate with ESP32-based slave devices. It handles the SAS (Slot Accounting System) protocol events and status updates.
-   **Accounting & Auditing**: Manages a SQLite database for transactions, system logs, and administrative actions. Generates Excel reports for auditing.
-   **Hardware Integration**: Supports local hardware on a Raspberry Pi, including an OLED display (SH1106) for status and a DHT11 sensor for environmental monitoring (temperature/humidity).

### Main Technologies
-   **Backend**: Python 3, Flask, SQLite3, Sockets (Threading).
-   **Frontend**: HTML5, Vanilla CSS, JavaScript (AJAX/Fetch for real-time updates).
-   **Libraries**: `openpyxl` (Excel), `python-dotenv` (Config), `werkzeug` (Security), `adafruit-circuitpython-dht`, `luma.oled`.

---

## Building and Running

### Prerequisites
-   Python 3.7+
-   Recommended: Raspberry Pi 4 for full hardware support.
-   Dependencies: `pip install flask openpyxl python-dotenv werkzeug adafruit-circuitpython-dht luma.oled pillow`

### Configuration
1.  **Environment Variables**: Create/Edit the `.env` file in this directory:
    -   `PUERTO_WEB`: Port for the Flask web server (default: 5000).
    -   `PUERTO_UDP`: Port for slave discovery (default: 8081).
    -   `DB_NAME`: Path to the SQLite database (default: `casino_data.db`).
    -   `MAX_CLIENTS`: Maximum number of slot machines (default: 10).
    -   `FLASK_SECRET_KEY`: Secret key for session encryption.
    -   `ENABLE_OLED`, `ENABLE_DHT`: Toggle hardware features (True/False).

### Running the Application
-   **Main App**: `python maestro.py`
-   **Hardware Diagnostics**: `python diagnostico_hardware.py` (Use this to verify I2C devices and sensors on a Pi).

---

## Development Conventions

### Architecture
-   **Concurrency**: Uses `threading.RLock` (`db_lock`) to synchronize database access between web requests and background socket threads.
-   **Data Storage**:
    -   `casino_data.db`: Relational data (transactions, users, logs).
    -   `nombres_db.json`: Persistent mapping of machine slots to names.
    -   `backups/`: Directory for automated daily/manual database snapshots.

### Security & Roles
-   **Roles**: `admin`, `supervisor`, `operador`, `consulta`.
-   **Financial Limits**: Limits for single operations and daily totals are enforced based on the user's role (configured in `maestro.py`).
-   **Logs**: All critical actions are recorded in `logs_slot`, `acciones_admin`, and `system_logs`.

### Key Files
-   `maestro.py`: The heart of the system. Contains the Flask routes, socket server logic, and database operations.
-   `diagnostico_hardware.py`: Script to test DHT11 and OLED connectivity.
-   `static/js/main.js`: Handles all frontend logic, including real-time machine status polling and AJAX commands.
-   `templates/`: Jinja2 templates for the web interface.

---

## Maintenance
-   **Backups**: Manual backups can be triggered from the dashboard (Admin only). The system also attempts to rotate backups.
-   **Error Logs**: Check `registro_errores.log` for runtime exceptions and communication issues.
-   **Reporting**: Excel reports are generated on-the-fly via the `/exportar_excel` and `/admin_log_excel` routes.
