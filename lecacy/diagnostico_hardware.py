#!/usr/bin/env python3
"""Diagnostico rapido de hardware para la Pi4.
Correlo con: python diagnostico_hardware.py
"""
import sys
import os

print("=" * 50)
print("DIAGNOSTICO DE HARDWARE")
print("=" * 50)

# 1. Librerias Python
print("\n[1] Librerias Python:")
try:
    import board
    print("  [OK] board")
except Exception as e:
    print(f"  [FALTA] board: {e}")
    board = None

try:
    import adafruit_dht
    print("  [OK] adafruit_dht")
except Exception as e:
    print(f"  [FALTA] adafruit_dht: {e}")
    adafruit_dht = None

try:
    from luma.core.interface.serial import i2c as luma_i2c
    from luma.core.render import canvas
    from luma.oled.device import sh1106
    print("  [OK] luma.oled")
except Exception as e:
    print(f"  [FALTA] luma.oled: {e}")
    luma_i2c = None
    canvas = None
    sh1106 = None

try:
    from PIL import ImageFont
    print("  [OK] PIL.ImageFont")
except Exception as e:
    print(f"  [FALTA] PIL: {e}")
    ImageFont = None

# 2. Bus I2C
print("\n[2] Dispositivos I2C:")
try:
    import subprocess
    out = subprocess.check_output(["i2cdetect", "-y", "1"], text=True, stderr=subprocess.STDOUT)
    print(out)
except Exception as e:
    print(f"  No se pudo listar I2C: {e}")
    print("  (Asegurate de tener i2c-tools y el bus habilitado con raspi-config)")

# 3. Probar DHT11
print("\n[3] DHT11 (GPIO17):")
if board and adafruit_dht:
    try:
        dht = adafruit_dht.DHT11(board.D17)
        import time
        time.sleep(2)
        t = dht.temperature
        h = dht.humidity
        if t is not None:
            print(f"  [OK] Temperatura: {t}C")
        else:
            print("  [WARN] temperatura = None (puede ser normal en la primera lectura)")
        if h is not None:
            print(f"  [OK] Humedad: {h}%")
        else:
            print("  [WARN] humedad = None")
        dht.exit()
    except Exception as e:
        print(f"  [ERROR] {e}")
else:
    print("  [SKIP] Faltan librerias")

# 4. Probar OLED
print("\n[4] OLED SH1106 (I2C 0x3C):")
if luma_i2c and sh1106 and canvas:
    try:
        serial = luma_i2c(port=1, address=0x3C)
        device = sh1106(serial, width=128, height=64)
        from PIL import ImageFont
        try:
            f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        except Exception:
            f = ImageFont.load_default()
        with canvas(device) as draw:
            draw.rectangle(device.bounding_box, outline="white", fill="black")
            draw.text((10, 20), "TEST OK", font=f, fill="white")
        print("  [OK] OLED dibujada. Deberias ver 'TEST OK' en la pantalla.")
    except Exception as e:
        print(f"  [ERROR] {e}")
else:
    print("  [SKIP] Faltan librerias")

# 5. Archivos modificados
print("\n[5] Verificacion de archivos:")
BASE = os.path.dirname(os.path.abspath(__file__))
for fname in ["maestro.py", "templates/base.html", "static/js/main.js"]:
    path = os.path.join(BASE, fname)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        checks = {
            "maestro.py": ["api_clima", "_init_dht", "_oled_display_loop"],
            "templates/base.html": ["header-clima"],
            "static/js/main.js": ["updateClima", "/api/clima"],
        }
        missing = [c for c in checks.get(fname, []) if c not in content]
        if missing:
            print(f"  [WARN] {fname}: faltan strings {missing}")
        else:
            print(f"  [OK] {fname} contiene las modificaciones")
    else:
        print(f"  [FALTA] {path}")

print("\n" + "=" * 50)
print("FIN DEL DIAGNOSTICO")
print("=" * 50)
