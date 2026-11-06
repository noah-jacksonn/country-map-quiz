export type Point = { x: number; y: number };

// Expanded marker hit areas can overlap. Resolve them by proximity, not SVG paint order.
export function nearestMarker(point: Point, markers: (Point & { id: string })[]): string | null {
  let nearest: string | null = null;
  let distance = Infinity;
  for (const marker of markers) {
    const next = (point.x - marker.x) ** 2 + (point.y - marker.y) ** 2;
    if (next < distance) { nearest = marker.id; distance = next; }
  }
  return nearest;
}
