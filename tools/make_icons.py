"""Builds the toolbar icons (icons/icon{16,32,48,128}.png) from the cat sprite,
and 128px README previews of every sprite (docs/pets/*.png).

The pet sprites in images/pets/ were drawn with the Pixel Art MCP server
(https://github.com/adrianoamaral/pixel-mcp). This script only scales the
16x16 sprites up with nearest-neighbour, so they stay crisp.

Run from the project root:  python3 tools/make_icons.py
"""
import os
import struct
import zlib

ROOT = os.path.join(os.path.dirname(__file__), '..')
SOURCE = os.path.join(ROOT, 'images', 'pets', 'cat-idle.png')


def read_png(path):
    data = open(path, 'rb').read()
    pos, idat = 8, b''
    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos + 4])[0]
        kind, body = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + length]
        if kind == b'IHDR':
            width, height = struct.unpack('>II', body[:8])
        elif kind == b'IDAT':
            idat += body
        pos += 12 + length
    raw, bpp = zlib.decompress(idat), 4
    stride, rows, prev = width * bpp, [], bytearray(width * bpp)
    for y in range(height):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(bytes(line))
        prev = line
    return width, height, rows


def write_png(path, size, pixel):
    raw = b''.join(b'\x00' + b''.join(pixel(x, y) for x in range(size)) for y in range(size))

    def chunk(kind, body):
        return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xFFFFFFFF)

    header = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def scale(source, dest, size):
    w, h, rows = read_png(source)

    def pixel(x, y):
        sx, sy = x * w // size, y * h // size
        return rows[sy][sx * 4:sx * 4 + 4]
    write_png(dest, size, pixel)


if __name__ == '__main__':
    icon_dir = os.path.join(ROOT, 'icons')
    os.makedirs(icon_dir, exist_ok=True)
    for size in (16, 32, 48, 128):
        scale(SOURCE, os.path.join(icon_dir, f'icon{size}.png'), size)
    print('Icons written to', os.path.abspath(icon_dir))

    pets_dir = os.path.join(ROOT, 'images', 'pets')
    docs_dir = os.path.join(ROOT, 'docs', 'pets')
    os.makedirs(docs_dir, exist_ok=True)
    for name in sorted(os.listdir(pets_dir)):
        if name.endswith('.png'):
            scale(os.path.join(pets_dir, name), os.path.join(docs_dir, name), 128)
    print('README previews written to', os.path.abspath(docs_dir))
