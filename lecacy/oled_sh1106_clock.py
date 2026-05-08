#!/usr/bin/env python3
import socket
import subprocess
import time
from datetime import datetime

from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import sh1106
from PIL import ImageFont


I2C_PORT = 1
I2C_ADDRESS = 0x3C
REFRESH_SECONDS = 1


def get_hostname():
    return socket.gethostname()


def get_ip_address():
    try:
        output = subprocess.check_output(["hostname", "-I"], text=True).strip()
        if output:
            return output.split()[0]
    except Exception:
        pass
    return "Sin IP"


def get_uptime():
    try:
        with open("/proc/uptime", "r", encoding="utf-8") as fh:
            total_seconds = int(float(fh.read().split()[0]))
        hours, remainder = divmod(total_seconds, 3600)
        minutes, _ = divmod(remainder, 60)
        return f"Up {hours:02d}:{minutes:02d}"
    except Exception:
        return "Up --:--"


def draw_screen(device, font_small, font_large):
    now = datetime.now()
    hora = now.strftime("%H:%M:%S")
    fecha = now.strftime("%d/%m/%Y")
    host = get_hostname()
    ip_addr = get_ip_address()
    uptime = get_uptime()

    with canvas(device) as draw:
        draw.rectangle(device.bounding_box, outline="white", fill="black")
        draw.text((4, 3), "AG Maestro", font=font_small, fill="white")
        draw.text((4, 18), hora, font=font_large, fill="white")
        draw.text((4, 42), fecha, font=font_small, fill="white")
        draw.text((4, 53), host[:18], font=font_small, fill="white")
        draw.text((4, 64), ip_addr[:20], font=font_small, fill="white")
        draw.text((4, 75), uptime, font=font_small, fill="white")


def main():
    serial = i2c(port=I2C_PORT, address=I2C_ADDRESS)
    device = sh1106(serial)

    try:
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
    except Exception:
        font_small = ImageFont.load_default()
        font_large = ImageFont.load_default()

    while True:
        draw_screen(device, font_small, font_large)
        time.sleep(REFRESH_SECONDS)


if __name__ == "__main__":
    main()
