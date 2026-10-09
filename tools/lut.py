#!/usr/bin/env python3
"""
Write a colour lookup table of N³ entries as a strip of N slices side by side, an image N² pixels wide and N tall, the
layout Balder's Texture3D loads (balder::core::shader::texture::d3): the pixel (r + b × N, g) holds the colour graded
from the colour (r, g, b) / (N - 1), the red growing along x, the green along y from the top row, the blue from slice to
slice. The colours are encoded in sRGB, read and written so by the grading of the post-process chain.

    tools/lut.py neutral res/lut/neutral.png
    tools/lut.py film res/lut/film.png --size 32
"""

import argparse
import struct
import zlib


def neutral(r, g, b):
    """
    The colour unchanged: the LUT a grading starts from in an image editor
    """
    return r, g, b


def film(r, g, b):
    """
    A filmic grade: a contrast curve, a little more saturation, teal shadows and warm highlights
    """
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    c = [luma + (x - luma) * 1.2 for x in (r, g, b)]

    shadows, highlights = (1.0 - luma) ** 2, luma ** 2
    tint = [shadows * s + highlights * h for s, h in zip((-0.04, 0.02, 0.06), (0.07, 0.02, -0.05))]
    c = [min(max(x + t, 0.0), 1.0) for x, t in zip(c, tint)]

    return tuple(x + (x * x * (3.0 - 2.0 * x) - x) * 0.4 for x in c)


GRADES = {"neutral": neutral, "film": film}


def strip(grade, n):
    """
    @returns: the rows of the strip of a grade of n³ entries, bytes of RGB
    """
    rows = []
    for y in range(n):
        row = bytearray()
        for x in range(n * n):
            r, g, b = (x % n) / (n - 1), y / (n - 1), (x // n) / (n - 1)
            row.extend(round(min(max(v, 0.0), 1.0) * 255.0) for v in grade(r, g, b))
        rows.append(bytes(row))

    return rows


def write_png(path, width, height, rows):
    """
    Write an RGB image of 8 bits per channel in a PNG file
    """
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + row for row in rows)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        f.write(chunk(b"IEND", b""))


def main():
    parser = argparse.ArgumentParser(description="Write a colour lookup table as a strip of slices")
    parser.add_argument("grade", choices=sorted(GRADES))
    parser.add_argument("output")
    parser.add_argument("--size", type=int, default=32, help="the number of entries along each axis, N")
    args = parser.parse_args()

    write_png(args.output, args.size * args.size, args.size, strip(GRADES[args.grade], args.size))


if __name__ == "__main__":
    main()
