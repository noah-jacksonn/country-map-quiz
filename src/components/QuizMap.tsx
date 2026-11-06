import { memo, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Check, Minus, Plus, Scan } from 'lucide-react';
import geography from '../data/map.json';
import { countries, countryFlag, countryName } from '../data/countries';
import type { Answer } from '../game';

type Point = { x: number; y: number };
type Camera = Point & { zoom: number };
type Props = {
  answers: Answer[]; included: string[]; revealed: string | null;
  flash: string | null; onGuess: (id: string) => void;
  wrong: string | null;
};
const anchors = geography.anchors as Record<string, number[]>;
const bound = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
// Center the playable region below Russia, leaving its northern/eastern extent offscreen.
const focus = { x: 640, y: 615 };
const origin = { x: 0, y: 0, zoom: 1.5 };
const minimumLabelSize = 10;
const maximumLabelSize = 12;

export const QuizMap = memo(function QuizMap({ answers, included, revealed, flash, onGuess, wrong }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [camera, setCamera] = useState<Camera>(origin);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const gesture = useRef<{ down: Point; last: Point; country: string | null; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; center: Point } | null>(null);
  const suppressClick = useRef(false);
  const base = Math.min(size.width / 1600, size.height / 1000);
  const scale = base * camera.zoom;
  const answered = new Map(answers.map(answer => [answer.id, answer]));
  const includeSet = new Set(included);
  const labeledCountries = geography.countries.filter(country =>
    answered.has(country.id) && country.label.fontSize * scale >= minimumLabelSize);
  const hoveredAnswer = hovered && answered.has(hovered) && !dragging && !wrong && !flash ? hovered : null;

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  function zoomAt(factor: number, point: Point, movement: Point = { x: 0, y: 0 }) {
    setCamera(previous => {
      const zoom = bound(previous.zoom * factor, 0.8, 8);
      const ratio = zoom / previous.zoom;
      return { zoom,
        x: point.x - size.width / 2 - (point.x - size.width / 2 - previous.x) * ratio + movement.x,
        y: point.y - size.height / 2 - (point.y - size.height / 2 - previous.y) * ratio + movement.y };
    });
  }

  useEffect(() => {
    const element = ref.current;
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const rect = element!.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.002), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
    element?.addEventListener('wheel', wheel, { passive: false });
    return () => element?.removeEventListener('wheel', wheel);
    // The listener uses only viewport size; the camera update is functional.
  }, [size.width, size.height]);

  const screen = (point: number[]): Point => ({ x: (point[0] - focus.x) * scale + size.width / 2 + camera.x,
    y: (point[1] - focus.y) * scale + size.height / 2 + camera.y });
  const eventPoint = (event: ReactPointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const countryAt = (target: EventTarget) => (target as Element).closest('[data-country-id]')?.getAttribute('data-country-id') ?? null;

  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const point = eventPoint(event);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) {
      gesture.current = { down: point, last: point, country: countryAt(event.target), moved: false };
      suppressClick.current = false;
    } else {
      suppressClick.current = true;
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(b.x - a.x, b.y - a.y), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = eventPoint(event);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size > 1) {
      const [a, b] = [...pointers.current.values()];
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (pinch.current && pinch.current.distance > 0) {
        zoomAt(distance / pinch.current.distance, pinch.current.center,
          { x: center.x - pinch.current.center.x, y: center.y - pinch.current.center.y });
      }
      pinch.current = { center, distance };
      setDragging(true);
    } else if (gesture.current) {
      const current = gesture.current;
      if (Math.hypot(point.x - current.down.x, point.y - current.down.y) > 5) current.moved = true;
      if (current.moved) {
        const dx = point.x - current.last.x, dy = point.y - current.last.y;
        setCamera(previous => ({ ...previous,
          x: bound(previous.x + dx, -1600 * base * previous.zoom * 0.6, 1600 * base * previous.zoom * 0.6),
          y: bound(previous.y + dy, -1000 * base * previous.zoom * 0.6, 1000 * base * previous.zoom * 0.6) }));
        setDragging(true);
      }
      current.last = point;
    }
  }
  function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const current = gesture.current;
    if (event.type !== 'pointercancel' && pointers.current.size === 1 && current && !current.moved && !suppressClick.current && current.country) {
      onGuess(current.country);
    }
    pointers.current.delete(event.pointerId);
    pinch.current = null;
    if (pointers.current.size === 0) { gesture.current = null; setDragging(false); }
    else if (current) { current.last = [...pointers.current.values()][0]; current.moved = true; }
  }

  return <>
    <svg ref={ref} className={`quiz-map${dragging ? ' is-dragging' : ''}`} data-map-surface
      viewBox={`0 0 ${size.width} ${size.height}`} aria-label="Interactive map of Asia"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
      onPointerOver={event => setHovered(countryAt(event.target))} onPointerLeave={() => setHovered(null)}>
      <defs>{labeledCountries.map(country => <clipPath id={`label-${country.id}`} key={country.id}><path d={country.path} /></clipPath>)}</defs>
      <g transform={`translate(${size.width / 2 + camera.x} ${size.height / 2 + camera.y}) scale(${scale}) translate(${-focus.x} ${-focus.y})`}>
        <path d={geography.context} className="context-land" />
        {geography.countries.map(country => {
          const answer = answered.get(country.id);
          const active = includeSet.has(country.id);
          return <path key={country.id} d={country.path ?? ''} data-country-id={country.id}
            className={`country ${active ? 'included' : 'excluded'}${answer ? ` answered${answer.assisted ? ' assisted' : ''}` : ''}${revealed === country.id ? ' revealed' : ''}${flash === country.id ? ' just-correct' : ''}${hovered === country.id ? ' hovered' : ''}${wrong === country.id ? ' wrong' : ''}`}
            tabIndex={active && !answer ? 0 : -1} role="button" aria-label={countryName(country.id)} aria-disabled={!active || !!answer}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onGuess(country.id); } }} />;
        })}
        {labeledCountries.map(country =>
          <text key={country.id} className="country-label" x={country.label.x} y={country.label.y}
            fontSize={Math.min(country.label.fontSize, maximumLabelSize / scale)} textAnchor="middle" dominantBaseline="central"
            clipPath={`url(#label-${country.id})`} aria-hidden="true">{countryName(country.id)}</text>)}
      </g>
      <g className="small-countries">
        {countries.filter(country => 'small' in country && includeSet.has(country.id)).map(country => {
          const point = screen(anchors[country.id]);
          const answer = answered.get(country.id);
          return <g key={country.id} data-country-id={country.id} className={`small-country${answer ? ' answered' : ''}${answer?.assisted ? ' assisted' : ''}${revealed === country.id ? ' revealed' : ''}${wrong === country.id ? ' wrong' : ''}`} transform={`translate(${point.x} ${point.y})`}>
            <circle className="small-hit" r="10" /><circle className="small-dot" r={camera.zoom > 3 ? 2 : 3.5} />
          </g>;
        })}
      </g>
    </svg>
    {hoveredAnswer && <div className="found-feedback" aria-label={`Found country: ${countryName(hoveredAnswer)}`}>
      <Check className="found-feedback-icon" size={18} aria-hidden="true" />
      <span className="country-flag" aria-hidden="true">{countryFlag(hoveredAnswer)}</span><strong>{countryName(hoveredAnswer)}</strong>
    </div>}
    <div className="map-controls surface" aria-label="Map controls">
      <button aria-label="Zoom in" title="Zoom in" disabled={camera.zoom >= 8} onClick={() => zoomAt(1.4, { x: size.width / 2, y: size.height / 2 })}><Plus size={18} /></button>
      <button aria-label="Zoom out" title="Zoom out" disabled={camera.zoom <= 0.8} onClick={() => zoomAt(1 / 1.4, { x: size.width / 2, y: size.height / 2 })}><Minus size={18} /></button>
      <span className="control-divider" />
      <button aria-label="Reset map view" title="Reset map view" onClick={() => setCamera(origin)}><Scan size={17} /></button>
    </div>
  </>;
});
