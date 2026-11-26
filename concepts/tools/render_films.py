"""Render the KEKA concept hero films from runway photographs.

Each concept gets two loops: a landscape cut for desktop and a portrait cut for
phones. Frames are composed with Pillow and piped to ffmpeg (H.264, yuv420p,
faststart, no audio) so they autoplay muted inline on iOS and Android.

Usage:
    python3 render_films.py <photo_dir> <out_dir> [conveyor|backstage|showroom ...]

<photo_dir> holds the runway JPEGs downloaded from keka.design, flat.
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageOps

FPS = 24


def ease_in_out(t):
    t = min(max(t, 0.0), 1.0)
    return 0.5 - 0.5 * math.cos(math.pi * t)


def ease_out_expo(t):
    t = min(max(t, 0.0), 1.0)
    return 1.0 if t >= 1 else 1 - 2 ** (-10 * t)


class Photos:
    def __init__(self, folder, long_side=2000):
        self.folder = folder
        self.long_side = long_side
        self.cache = {}

    def get(self, name):
        if name not in self.cache:
            im = Image.open(os.path.join(self.folder, name)).convert("RGB")
            im = ImageOps.exif_transpose(im)
            s = self.long_side / max(im.size)
            if s < 1:
                im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
            self.cache[name] = im
        return self.cache[name]


def cover(im, w, h, zoom=1.0, fx=0.5, fy=0.42, dx=0.0, dy=0.0):
    """Crop `im` to fill w x h (object-fit: cover), zoomed about a focal point.

    fx/fy is the focal point as a fraction of the source; dx/dy pans in output
    pixels. Uses a float affine transform so slow push-ins stay smooth.
    """
    sw, sh = im.size
    scale = max(w / sw, h / sh) * zoom
    # source rect size
    rw, rh = w / scale, h / scale
    cx = fx * sw - dx / scale
    cy = fy * sh - dy / scale
    x0 = min(max(cx - rw / 2, 0), sw - rw)
    y0 = min(max(cy - rh / 2, 0), sh - rh)
    return im.transform((w, h), Image.AFFINE, (1 / scale, 0, x0, 0, 1 / scale, y0), resample=Image.BICUBIC)


def grade(frame, kind):
    a = np.asarray(frame).astype(np.float32) / 255.0
    if kind == "cool":  # frosted, slightly lifted blacks, cooler
        a = 0.04 + a * 0.94
        lum = a.mean(axis=2, keepdims=True)
        a = lum + (a - lum) * 0.82
        a[..., 2] *= 1.03
        a[..., 0] *= 0.985
    elif kind == "punch":  # backstage: contrast up, warm skin, deep blacks
        a = np.clip((a - 0.5) * 1.12 + 0.5, 0, 1)
        a = a ** 1.05
    elif kind == "warm":  # showroom: soft, warm, gentle roll-off
        a = 0.02 + a * 0.96
        a[..., 0] *= 1.02
        a[..., 2] *= 0.97
        a = a - 0.08 * (a ** 3)
    return Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8))


def vignette(w, h, strength=0.35):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (x / w - 0.5) * 2
    ny = (y / h - 0.5) * 2
    r = np.sqrt(nx ** 2 * 0.8 + ny ** 2)
    v = 1 - strength * np.clip(r - 0.55, 0, None) ** 1.6
    return v[..., None].astype(np.float32)


def apply_vignette(frame, vig):
    a = np.asarray(frame).astype(np.float32)
    return Image.fromarray(np.clip(a * vig, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- conveyor
def conveyor_frame(photos, names, w, h, t, period_per, visible):
    """A strip of runway frames that runs and stops like a garment conveyor."""
    n = len(names)
    fw = w / visible
    move = 1.0
    k = math.floor(t / period_per)
    local = t - k * period_per
    # the motor pulls away briskly and the rail settles with an exponential ease-out, no overshoot
    u = min(local / move, 1.0)
    p = ease_out_expo(u) if u > 0.12 else ease_out_expo(0.12) * (u / 0.12) ** 2
    offset = (k + p) * fw  # pixels travelled
    canvas = Image.new("RGB", (w, h), (18, 19, 22))
    seam = max(2, round(w / 640))
    first = math.floor(offset / fw) - 1
    for i in range(first, first + int(visible) + 3):
        x = i * fw - offset
        if x > w or x + fw < 0:
            continue
        name = names[i % n]
        tile = cover(photos.get(name), int(math.ceil(fw)) - seam, h, zoom=1.0, fy=0.45)
        canvas.paste(tile, (int(round(x)), 0))
    return canvas


def render_conveyor(photos, out, w, h, names, visible, period_per):
    total = len(names) * period_per
    vig = vignette(w, h, 0.25)
    for f in range(int(round(total * FPS))):
        t = f / FPS
        fr = conveyor_frame(photos, names, w, h, t, period_per, visible)
        fr = grade(fr, "cool")
        yield apply_vignette(fr, vig)


# ---------------------------------------------------------------- backstage
def render_backstage(photos, out, w, h, columns, shot):
    """Hard cuts with a camera-flash bloom; desktop shows a staggered triptych."""
    ncol = len(columns)
    per_col = len(columns[0])
    total = per_col * shot
    cw = w / ncol
    vig = vignette(w, h, 0.3)
    for f in range(int(round(total * FPS))):
        t = f / FPS
        canvas = Image.new("RGB", (w, h), (8, 8, 8))
        flash = np.zeros((h, w, 1), np.float32)
        for c, names in enumerate(columns):
            tc = (t - c * shot / ncol) % total
            k = int(tc // shot)
            local = tc - k * shot
            name = names[k]
            zoom = 1.04 + 0.06 * (local / shot)
            jitter = 2.0 * math.sin(t * 7.1 + c) * (w / 1600)
            tile = cover(photos.get(name), int(math.ceil(cw)) - (2 if ncol > 1 else 0), h, zoom=zoom, fy=0.38, dx=jitter, dy=jitter * 0.6)
            canvas.paste(tile, (int(round(c * cw)), 0))
            fl = max(0.0, 1 - local / 0.16) ** 2 * 0.85
            if fl > 0:
                x0, x1 = int(round(c * cw)), int(round((c + 1) * cw))
                flash[:, x0:x1] = fl
        fr = grade(canvas, "punch")
        a = np.asarray(fr).astype(np.float32)
        a = a + (255 - a) * flash
        yield apply_vignette(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), vig)


# ---------------------------------------------------------------- showroom
def render_showroom(photos, out, w, h, shots, shot, fade):
    """Slow push-ins joined by long dissolves."""
    n = len(shots)
    total = n * shot
    vig = vignette(w, h, 0.4)

    def still(i, local):
        name, fx, fy = shots[i % n]
        zoom = 1.0 + 0.07 * ((local + fade) / (shot + fade))
        return cover(photos.get(name), w, h, zoom=zoom, fx=fx, fy=fy)

    for f in range(int(round(total * FPS))):
        t = f / FPS
        k = int(t // shot)
        local = t - k * shot
        cur = still(k, local)
        if local > shot - fade:
            nxt = still(k + 1, local - shot)
            a = ease_in_out((local - (shot - fade)) / fade)
            cur = Image.blend(cur, nxt, a)
        elif k == 0 and local < 0:  # unreachable, kept for clarity
            pass
        fr = grade(cur, "warm")
        yield apply_vignette(fr, vig)


# ---------------------------------------------------------------- lineup
def render_lineup(photos, out, w, h, names, visible, per):
    """A runway line-up gliding past at constant speed, natural colour."""
    n = len(names)
    fw = w / visible
    total = n * per
    vig = vignette(w, h, 0.18)
    for f in range(int(round(total * FPS))):
        t = f / FPS
        offset = (t / per) * fw
        canvas = Image.new("RGB", (w, h), (12, 12, 12))
        seam = max(2, round(w / 800))
        first = math.floor(offset / fw) - 1
        for i in range(first, first + int(visible) + 3):
            x = i * fw - offset
            if x > w or x + fw < 0:
                continue
            tile = cover(photos.get(names[i % n]), int(math.ceil(fw)) - seam, h, zoom=1.0, fy=0.45)
            canvas.paste(tile, (int(round(x)), 0))
        yield apply_vignette(canvas, vig)


def encode(frames, w, h, path, crf):
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p",
        "-profile:v", "high", "-movflags", "+faststart", "-an", path,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    first = None
    for fr in frames:
        if first is None:
            first = fr.copy()
        proc.stdin.write(fr.tobytes())
    proc.stdin.close()
    proc.wait()
    poster = path.rsplit(".", 1)[0] + ".jpg"
    first.save(poster, quality=82, optimize=True, progressive=True)
    return path


CONVEYOR = [
    "photo-209.jpg", "DSC02700.jpg", "photo-212.jpg", "photo-216.jpg", "DSC02744.jpg",
    "photo-223.jpg", "photo-229.jpg", "DSC02672.jpg", "photo-225.jpg", "photo-210.jpg",
    "DSC02620.jpg", "photo-217.jpg",
]
BACKSTAGE_DESK = [
    ["photo-224.jpg", "DSC02726.jpg", "photo-211.jpg", "DSC02645.jpg"],
    ["DSC02605.jpg", "photo-227.jpg", "DSC02596.jpg", "photo-215.jpg"],
    ["photo-213.jpg", "DSC02708.jpg", "photo-231.jpg", "DSC02656.jpg"],
]
BACKSTAGE_MOBILE = [[
    "photo-224.jpg", "DSC02726.jpg", "photo-213.jpg", "DSC02605.jpg", "photo-227.jpg",
    "DSC02596.jpg", "photo-211.jpg", "DSC02708.jpg",
]]
SHOWROOM_DESK = [
    ("photo-229.jpg", 0.5, 0.36), ("photo-224.jpg", 0.5, 0.42), ("DSC02744.jpg", 0.5, 0.34),
    ("photo-227.jpg", 0.5, 0.4), ("DSC02645.jpg", 0.5, 0.36),
]
SHOWROOM_MOBILE = [
    ("photo-229.jpg", 0.5, 0.45), ("photo-209.jpg", 0.5, 0.45), ("DSC02744.jpg", 0.5, 0.45),
    ("photo-226.jpg", 0.5, 0.45), ("DSC02678.jpg", 0.5, 0.45),
]


def main():
    src, out = sys.argv[1], sys.argv[2]
    which = sys.argv[3:] or ["conveyor", "backstage", "showroom"]
    os.makedirs(out, exist_ok=True)
    photos = Photos(src)
    jobs = []
    if "conveyor" in which:
        jobs += [
            ("conveyor-desktop.mp4", 1600, 900, render_conveyor(photos, out, 1600, 900, CONVEYOR, 3.6, 1.5), 27),
            ("conveyor-mobile.mp4", 720, 1280, render_conveyor(photos, out, 720, 1280, CONVEYOR, 1.0, 1.5), 27),
        ]
    if "backstage" in which:
        jobs += [
            ("backstage-desktop.mp4", 1600, 900, render_backstage(photos, out, 1600, 900, BACKSTAGE_DESK, 2.4), 27),
            ("backstage-mobile.mp4", 720, 1280, render_backstage(photos, out, 720, 1280, BACKSTAGE_MOBILE, 1.5), 27),
        ]
    if "showroom" in which:
        jobs += [
            ("showroom-desktop.mp4", 1600, 900, render_showroom(photos, out, 1600, 900, SHOWROOM_DESK, 3.2, 1.1), 26),
            ("showroom-mobile.mp4", 720, 1280, render_showroom(photos, out, 720, 1280, SHOWROOM_MOBILE, 3.2, 1.1), 26),
        ]
    if "lineup" in which:
        line = ["photo-229.jpg", "photo-223.jpg", "DSC02744.jpg", "photo-226.jpg", "photo-209.jpg", "DSC02700.jpg", "photo-212.jpg", "photo-225.jpg", "DSC02672.jpg", "photo-216.jpg"]
        jobs += [
            ("lineup-desktop.mp4", 1600, 900, render_lineup(photos, out, 1600, 900, line, 3.3, 2.6), 26),
            ("lineup-mobile.mp4", 720, 1280, render_lineup(photos, out, 720, 1280, line, 1.25, 2.6), 26),
        ]
    for name, w, h, frames, crf in jobs:
        path = encode(frames, w, h, os.path.join(out, name), crf)
        print(name, os.path.getsize(path) // 1024, "KB", flush=True)


if __name__ == "__main__":
    main()
