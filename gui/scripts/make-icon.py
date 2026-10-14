#!/usr/bin/env python3
"""Build the application icon from the in-app logo.

Reads `src/renderer/src/assets/logo.png` (the character shown inside the
application) and writes `build/icon.png` (512x512, the one the Electron window
and taskbar use) and `build/icons/<n>x<n>.png` in the sizes the .deb package
and the AppImage install -- electron-builder reads the size off the file name,
so the folder has to name them exactly like that.

The logo is not square: it is trimmed to its visible pixels and centred on a
transparent square canvas, so the character is never stretched.

Needs Pillow. Run it by hand when the logo changes; the resulting PNGs are
committed, so building the app does not need Python.

    python3 scripts/make-icon.py
"""
import os

from PIL import Image

SIZES = (512, 256, 128, 64, 48, 32, 16)
MARGIN = 1 / 32             # transparent border, as a fraction of the side


def square(logo, size):
    """The logo, fitted inside a transparent size x size canvas."""
    inner = size - 2 * round(size * MARGIN)
    fitted = logo.copy()
    fitted.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2), fitted)
    return canvas


if __name__ == "__main__":
    gui = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    build = os.path.join(gui, "build")
    icons = os.path.join(build, "icons")
    os.makedirs(icons, exist_ok=True)

    logo = Image.open(os.path.join(gui, "src", "renderer", "src", "assets", "logo.png")).convert("RGBA")
    logo = logo.crop(logo.getbbox())

    for size in SIZES:
        icon = square(logo, size)
        icon.save(os.path.join(icons, "%dx%d.png" % (size, size)), optimize=True)
        if size == 512:
            icon.save(os.path.join(build, "icon.png"), optimize=True)
        print("written %dx%d" % (size, size))
