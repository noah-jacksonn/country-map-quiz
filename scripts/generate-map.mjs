import { readFile, writeFile } from 'node:fs/promises';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

// Pre-project the public-domain geography so no mapping library or world data
// needs to be downloaded by the browser. The source stays in world-atlas.
const source = await readFile(new URL('../src/data/countries.ts', import.meta.url), 'utf8');
const definitions = [...source.matchAll(/id: '(\d+)', name: '([^']+)', location: \[([^\]]+)\]/g)]
  .map(([, id, name, coordinates]) => ({ id, name, location: coordinates.split(',').map(Number) }));
const topology = JSON.parse(await readFile(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url), 'utf8'));
const world = feature(topology, topology.objects.countries);
const contextTopology = JSON.parse(await readFile(new URL('../node_modules/world-atlas/countries-110m.json', import.meta.url), 'utf8'));
const contextWorld = feature(contextTopology, contextTopology.objects.countries);
const ids = new Set(definitions.map(d => d.id));
const selected = { type: 'FeatureCollection', features: world.features.filter(f => ids.has(f.id)) };
for (const { id, name } of definitions) {
  if (!selected.features.some(f => f.id === id)) throw new Error(`Missing geography: ${name}`);
}
const projection = geoEquirectangular().rotate([-100, 0]).center([0, 35])
  .fitExtent([[90, 70], [1510, 940]], selected).clipExtent([[-2000, -2000], [3600, 3000]]);
const path = geoPath(projection).digits(1);

function ringContains([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Fit a quiet horizontal label inside the largest land polygon. Even tiny
// countries retain their own label; zooming enlarges it with the geography.
function labelFor(country) {
  const definition = definitions.find(d => d.id === country.id);
  const polygons = country.geometry.type === 'Polygon' ? [country.geometry.coordinates] : country.geometry.coordinates;
  const polygon = polygons.map(coordinates => ({ type: 'Polygon', coordinates }))
    .sort((a, b) => path.area(b) - path.area(a))[0];
  const rings = polygon.coordinates.map(ring => ring.map(point => projection(point)));
  const inside = point => ringContains(point, rings[0]) && !rings.slice(1).some(ring => ringContains(point, ring));
  const [[left, top], [right, bottom]] = path.bounds(polygon);
  const centroid = path.centroid(polygon);
  let best = { x: centroid[0], y: centroid[1], fontSize: 0, distance: Infinity };
  const points = [projection(definition.location), centroid];
  for (let x = 1; x < 20; x++) for (let y = 1; y < 14; y++) {
    points.push([left + (right - left) * x / 20, top + (bottom - top) * y / 14]);
  }
  for (const point of points) {
    if (!inside(point)) continue;
    let low = 0, high = 14;
    for (let step = 0; step < 9; step++) {
      const font = (low + high) / 2, halfWidth = font * definition.name.length * 0.3, halfHeight = font * 0.55;
      const fits = [-1, 0, 1].every(dx => [-1, 0, 1].every(dy => inside([point[0] + dx * halfWidth, point[1] + dy * halfHeight])));
      if (fits) low = font; else high = font;
    }
    const distance = Math.hypot(point[0] - centroid[0], point[1] - centroid[1]);
    if (low > best.fontSize || (low === best.fontSize && distance < best.distance)) best = { x: point[0], y: point[1], fontSize: low, distance };
  }
  return { x: +best.x.toFixed(1), y: +best.y.toFixed(1), fontSize: +best.fontSize.toFixed(2) };
}
const map = {
  width: 1600, height: 1000,
  countries: selected.features.map(f => ({ id: f.id, path: path(f), label: labelFor(f) })),
  // The regional map excludes Antarctica. Context extends beyond the initial
  // frame so wide viewports and panning never expose a rectangular map edge.
  context: contextWorld.features.filter(f => !ids.has(f.id) && f.id !== '010').map(f => path(f)).filter(Boolean).join(''),
  anchors: Object.fromEntries(definitions.map(d => [d.id, projection(d.location).map(n => Math.round(n * 10) / 10)])),
};
await writeFile(new URL('../src/data/map.json', import.meta.url), JSON.stringify(map));
console.log(`Generated ${map.countries.length} countries; ${Math.round(JSON.stringify(map).length / 1024)} KB of SVG geometry.`);
