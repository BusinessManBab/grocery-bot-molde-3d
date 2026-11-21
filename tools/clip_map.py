"""Clip a game-map's road lines to the map bounds.

    python3 tools/clip_map.py data/game-map.json [--bounds x0,y0,x1,y1]

The flat map is built from the road graph, so a manually padded/trimmed board can keep road
lines that run past the board edge; in 3D they float outside the terrain. This cuts every
polyline at the bounds, keeping only the parts that are on the board. Bounds default to the
ones already in the file.
"""
import argparse
import json


def clip_piece(a, b, box):
    """Liang–Barsky: the part of segment a-b inside box, or None."""
    x0, y0, x1, y1 = box
    (ax, ay), (bx, by) = a, b
    dx, dy = bx - ax, by - ay
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, ax - x0), (dx, x1 - ax), (-dy, ay - y0), (dy, y1 - ay)):
        if p == 0:
            if q < 0:
                return None
            continue
        r = q / p
        if p < 0:
            t0 = max(t0, r)
        else:
            t1 = min(t1, r)
        if t0 > t1:
            return None
    return (ax + t0 * dx, ay + t0 * dy), (ax + t1 * dx, ay + t1 * dy)


def clip_line(line, box):
    """Split a flat [x, y, x, y…] polyline into the chains inside the box."""
    pts = list(zip(line[0::2], line[1::2]))
    out, cur = [], []
    for a, b in zip(pts, pts[1:]):
        piece = clip_piece(a, b, box)
        if piece is None:
            if cur:
                out.append(cur)
                cur = []
            continue
        start, end = piece
        if not cur:
            cur = [start]
        elif abs(cur[-1][0] - start[0]) > 1e-6 or abs(cur[-1][1] - start[1]) > 1e-6:
            out.append(cur)
            cur = [start]
        cur.append(end)
        if end != b:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    chains = []
    for chain in out:
        flat = []
        for x, y in chain:
            x, y = round(x), round(y)
            if flat and (flat[-2], flat[-1]) == (x, y):
                continue
            flat += [x, y]
        if len(flat) >= 4:
            chains.append(flat)
    return chains


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("map")
    parser.add_argument("--bounds", help="x0,y0,x1,y1 (default: the file's bounds)")
    args = parser.parse_args()
    data = json.load(open(args.map))
    box = tuple(map(int, args.bounds.split(","))) if args.bounds else tuple(data["bounds"])
    before = after = points = 0
    for kind, lines in data["roads"].items():
        kept = []
        for line in lines:
            before += 1
            points += len(line) // 2
            kept += clip_line(line, box)
        data["roads"][kind] = kept
        after += len(kept)
    with open(args.map, "w") as f:
        json.dump(data, f, separators=(",", ":"))
        f.write("\n")
    print(f"{args.map}: {before} road lines ({points} points) -> {after} lines inside {box}")


if __name__ == "__main__":
    main()
