#!/usr/bin/env python3
import subprocess
import time
from datetime import datetime

import board
import adafruit_dht
from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import sh1106
from PIL import ImageFont


I2C_PORT = 1
I2C_ADDRESS = 0x3C
REFRESH_SECONDS = 1
DHT_READ_INTERVAL = 3

dht = adafruit_dht.DHT11(board.D17)

last_temp = None
last_hum = None
last_dht_read = 0


def get_ip_address():
    try:
        output = subprocess.check_output(["hostname", "-I"], text=True).strip()
        if output:
            return output.split()[0]
    except Exception:
        pass
    return "Sin IP"


def update_dht_cache():
    global last_temp, last_hum, last_dht_read
    now = time.time()
    if now - last_dht_read < DHT_READ_INTERVAL:
        return

    last_dht_read = now
    try:
        temp = dht.temperature
        hum = dht.humidity
        if temp is not None:
            last_temp = temp
        if hum is not None:
            last_hum = hum
    except Exception:
        pass


def main():
    serial = i2c(port=I2C_PORT, address=I2C_ADDRESS)
    device = sh1106(serial, width=128, height=64)

    try:
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
        font_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 10)
        font_time = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except Exception:
        font_small = ImageFont.load_default()
        font_bold = ImageFont.load_default()
        font_time = ImageFont.load_default()

    while True:
        update_dht_cache()

        now = datetime.now()
        hora = now.strftime("%H:%M:%S")
        fecha = now.strftime("%d/%m/%Y")
        ip_addr = get_ip_address()

        temp_txt = f"[T] {last_temp}C" if last_temp is not None else "[T] --"
        hum_txt = f"[H] {last_hum}%" if last_hum is not None else "[H] --"

        with canvas(device) as draw:
            draw.rectangle(device.bounding_box, outline="white", fill="black")
            draw.text((4, 4), hora, font=font_time, fill="white")
            draw.text((4, 22), fecha, font=font_small, fill="white")
            draw.text((4, 36), temp_txt, font=font_small, fill="white")
            draw.text((68, 36), hum_txt, font=font_small, fill="white")
            draw.text((4, 52), ip_addr[:20], font=font_bold, fill="white")

        time.sleep(REFRESH_SECONDS)


if __name__ == "__main__":
    try:
        main()
    finally:
        dht.exit()
