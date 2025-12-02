#!/usr/bin/env python3
"""
Simple Frenzy single-player territory simulator.
Generates images of territory after specified times so you can quickly tune parameters.

Usage:
  python tools/frenzy_sim.py --times 10 60 120
  python tools/frenzy_sim.py --help

Dependencies:
  - numpy
  - matplotlib

This is intentionally self-contained and fast. It simulates units as points
moving outward from an HQ with simple angular diffusion and stamping a
circular "capture" brush as they move.
"""
import argparse
import math
import os
import sys
from dataclasses import dataclass
from typing import List

import matplotlib.pyplot as plt
import numpy as np


@dataclass
class Unit:
    x: float
    y: float
    angle: float


def stamp_circle(grid: np.ndarray, cx: int, cy: int, radius: int):
    h, w = grid.shape
    x0 = max(0, cx - radius)
    x1 = min(w - 1, cx + radius)
    y0 = max(0, cy - radius)
    y1 = min(h - 1, cy + radius)

    rr = np.arange(x0, x1 + 1)
    cc = np.arange(y0, y1 + 1)
    X, Y = np.meshgrid(rr, cc)
    dsq = (X - cx) ** 2 + (Y - cy) ** 2
    mask = dsq <= radius * radius
    grid[y0 : y1 + 1, x0 : x1 + 1][mask] = 1


def run_sim(
    width=400,
    height=400,
    max_time=120.0,
    dt=0.1,
    spawn_interval=0.5,
    spawn_count=8,
    starting_units=40,
    unit_speed=120.0,
    capture_radius=3,
    angular_diffusion=0.8,
    sep_radius=6,
    sep_strength=0.8,
    times_to_capture=(10, 60, 120),
    save_prefix="frenzy_sim",
    show=False,
):
    # grid: 0 = neutral, 1 = owned
    grid = np.zeros((height, width), dtype=np.uint8)

    cx = width // 2
    cy = height // 2

    # initial territory circle
    initial_radius = 8
    stamp_circle(grid, cx, cy, initial_radius)

    units: List[Unit] = []

    # spawn initial units
    for i in range(starting_units):
        angle = (2 * math.pi * i) / max(1, starting_units)
        units.append(Unit(cx + 0.001, cy + 0.001, angle))

    spawn_timer = spawn_interval

    times_to_capture = sorted(times_to_capture)
    next_time_index = 0
    next_time = times_to_capture[next_time_index] if times_to_capture else None

    t = 0.0
    step = 0
    saved_files = []

    while t <= max_time + 1e-9:
        # spawn
        spawn_timer -= dt
        if spawn_timer <= 0:
            spawn_timer += spawn_interval
            for i in range(spawn_count):
                a = np.random.uniform(0, 2 * math.pi)
                units.append(Unit(cx + 0.001, cy + 0.001, a))

        # update units
        positions = np.array([[u.x, u.y] for u in units]) if units else np.zeros((0, 2))
        for i, u in enumerate(units):
            # radial bias: point outward from center
            ux = u.x - cx
            uy = u.y - cy
            distc = math.hypot(ux, uy) + 1e-6
            radial_angle = math.atan2(uy, ux)

            # angle diffusion
            u.angle += np.random.normal(0.0, angular_diffusion * dt)

            # separation: push angle away from nearby units
            if len(units) > 1:
                # naive O(n^2) but small number of units is OK for quick tests
                sep_x = 0.0
                sep_y = 0.0
                for j, v in enumerate(units):
                    if i == j:
                        continue
                    dx = u.x - v.x
                    dy = u.y - v.y
                    d = math.hypot(dx, dy)
                    if d < sep_radius and d > 1e-6:
                        # push away
                        sep_x += dx / d
                        sep_y += dy / d
                if sep_x != 0.0 or sep_y != 0.0:
                    sep_ang = math.atan2(sep_y, sep_x)
                    # blend radial + current angle + separation
                    # move angle a bit towards sep_ang
                    # stronger sep_strength increases spread
                    u.angle = (
                        (1 - sep_strength) * u.angle + sep_strength * sep_ang
                    )

            # target angle tries to be outward but we keep current angle with some bias
            # blend current angle with radial direction
            blend = 0.6
            u.angle = (1 - blend) * u.angle + blend * radial_angle

            # move
            u.x += math.cos(u.angle) * unit_speed * dt
            u.y += math.sin(u.angle) * unit_speed * dt

            # clamp
            u.x = min(max(u.x, 0), width - 1)
            u.y = min(max(u.y, 0), height - 1)

            # capture: stamp a small circle around unit
            stamp_circle(grid, int(round(u.x)), int(round(u.y)), capture_radius)

        # periodic smoothing/grow ops (optional): small dilation to smooth holes
        # simple smoothing by stamping the centroid area as owned if large enough
        if step % 10 == 0:
            # optional: grow owned region slightly to mimic influence smoothing
            owned = grid.astype(bool)
            # naive dilation: stamp around every owned pixel (small radius)
            # but to keep performance, sample some owned points
            ys, xs = np.nonzero(owned)
            if len(xs) > 0:
                sample_idx = np.random.choice(len(xs), min(200, len(xs)), replace=False)
                for idx in sample_idx:
                    stamp_circle(grid, xs[idx], ys[idx], 1)

        # check if it's time to save
        if next_time is not None and t >= next_time - 1e-9:
            fname = f"{save_prefix}_{int(round(next_time))}s.png"
            save_figure(grid, fname, cx, cy)
            saved_files.append(fname)
            print(f"Saved {fname} at t={t:.1f}s (units={len(units)})")
            next_time_index += 1
            if next_time_index >= len(times_to_capture):
                next_time = None
            else:
                next_time = times_to_capture[next_time_index]

        t += dt
        step += 1

    if show:
        # show final
        save_figure(grid, f"{save_prefix}_final.png", cx, cy)
    return saved_files


def save_figure(grid: np.ndarray, fname: str, cx: int, cy: int):
    plt.figure(figsize=(6, 6))
    plt.imshow(grid, cmap="viridis", origin="lower")
    plt.scatter([cx], [cy], c="red", s=10)
    plt.title(fname)
    plt.axis("off")
    plt.tight_layout()
    plt.savefig(fname, dpi=150)
    plt.close()


def parse_args():
    p = argparse.ArgumentParser(description="Frenzy single-player territory simulator")
    p.add_argument("--times", nargs="*", type=int, default=[10, 60, 120], help="Seconds to save images at")
    p.add_argument("--out", default="frenzy_sim", help="Output file prefix")
    p.add_argument("--width", type=int, default=400)
    p.add_argument("--height", type=int, default=400)
    p.add_argument("--max-time", type=int, default=120)
    p.add_argument("--dt", type=float, default=0.05)
    p.add_argument("--spawn-interval", type=float, default=0.5)
    p.add_argument("--spawn-count", type=int, default=8)
    p.add_argument("--starting-units", type=int, default=40)
    p.add_argument("--speed", type=float, default=120.0)
    p.add_argument("--capture-radius", type=int, default=3)
    p.add_argument("--show", action="store_true")
    return p.parse_args()


def main():
    args = parse_args()
    saved = run_sim(
        width=args.width,
        height=args.height,
        max_time=args.max_time,
        dt=args.dt,
        spawn_interval=args.spawn_interval,
        spawn_count=args.spawn_count,
        starting_units=args.starting_units,
        unit_speed=args.speed,
        capture_radius=args.capture_radius,
        times_to_capture=args.times,
        save_prefix=args.out,
        show=args.show,
    )
    print("Done. Saved:")
    for s in saved:
        print(" -", s)


if __name__ == "__main__":
    main()
