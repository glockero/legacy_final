# AGENTS

## Scope
- This repo has two real code entrypoints only: `lecacy/maestro.py` (Flask + SQLite master controller) and `firm_esp32/SLAVE_16_04_26.ino` (ESP32 slave firmware).
- The directory name is intentionally `lecacy/`, not `legacy/`. Do not rename it casually; code and tracked files already depend on that path.

## Sources Of Truth
- Treat `GEMINI.md` as orientation only. Trust `lecacy/maestro.py` and `firm_esp32/SLAVE_16_04_26.ino` when docs disagree.
- There is no repo-local test, lint, formatter, typecheck, or CI config checked in. Do not invent npm/pytest/PlatformIO workflows that are not here.

## Run And Verify
- Start the controller with `python lecacy/maestro.py` from repo root, or `python maestro.py` inside `lecacy/`.
- `maestro.py` loads env vars from `lecacy/.env` next to the script, not from the repo root.
- Running `maestro.py` has side effects: it initializes/migrates `casino_data.db`, seeds initial users on an empty DB, creates a DB backup, starts the UDP/TCP network loop, and starts Flask on `PUERTO_WEB` (default `5000`).
- Smallest safe verification for controller-only edits is `python -m py_compile lecacy/maestro.py`.
- Firmware has no build config in-repo; if you change `SLAVE_16_04_26.ino`, keep verification to code inspection unless the user explicitly wants hardware flashing/build setup work.

## Repo-Specific Constraints
- This repo tracks live/runtime artifacts in git: `lecacy/.env`, `lecacy/casino_data.db`, `lecacy/backups/*.db`, `lecacy/*.xlsx`, `lecacy/reporte_actual.csv`, `lecacy/registro_errores.log`, and even `lecacy/__pycache__/...`. Avoid touching, regenerating, deleting, or formatting them unless the task is explicitly about those files.
- `lecacy/.env` is a tracked secrets/config file. Do not expose values in responses unless the user asks.
- Most web UI behavior is centralized in `lecacy/static/js/main.js`; the HTML templates are only `templates/base.html`, `templates/index.html`, and `templates/login.html`. For UI work, trace both the Flask route in `maestro.py` and the caller/rendering code in `main.js`.

## Hardware / Runtime Environment
- The controller runs on a **Raspberry Pi 4**.
- **I2C bus 1** has two devices sharing the bus:
  - An **RTC** (real-time clock).
  - An **OLED display SH1106** at address `0x3C`.
- **GPIO17** has a **DHT11** temperature/humidity sensor connected.
- There are two standalone test scripts in `lecacy/` that exercise this hardware:
  - `oled_sh1106_clock.py` — displays time, date, hostname, IP and uptime on the OLED.
  - `oled_sh1106_dht11.py` — displays time, date, temperature, humidity and IP on the OLED (reads DHT11 on `board.D17`).
- These scripts are **not imported by `maestro.py`**; they are utility/validation scripts. If you integrate them into the main app, keep them optional so the controller can still start when the hardware is absent.

## Architecture Notes
- `maestro.py` is a large single-file app; keep changes minimal and local instead of trying to split/refactor unrelated areas.
- SQLite access is intentionally guarded with the global `db_lock = threading.RLock()` because Flask handlers and socket threads share the same DB. Preserve that pattern when adding DB writes.
- Backups are stored under `lecacy/backups/`; the app keeps the newest 30 backup DB files.
- First-run credentials are seeded from env vars `INIT_ADMIN_*` and optional `INIT_OPERATOR_*`. If no admin password is provided, `maestro.py` generates a temporary one and logs it to stdout and `system_logs`.

## Controller <-> Firmware Coupling
- The controller listens for UDP beacons on `PUERTO_UDP` (default `8081`) and then opens TCP connections to slaves on port `8080`.
- The current wire protocol is string-based and hard-coded on both sides: UDP beacon `SAS_BEACON|<assetID>`, TCP registration `REGISTRO|<assetID>|<mac>`, heartbeat `PING` / `PONG|...`, and meter payloads containing `|METERS|`.
- If you change ports, handshake strings, or status payload formats, update both `lecacy/maestro.py` and `firm_esp32/SLAVE_16_04_26.ino` together.
- Firmware currently hard-codes Wi-Fi credentials and `assetID` inside `SLAVE_16_04_26.ino`; do not "clean that up" unless the task explicitly includes changing the device provisioning flow.
