import { useEffect, useLayoutEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { countryFlag, countryName } from '../data/countries';

type Props = { country: string; misses: number; correct: boolean; hidden: boolean };

export function PointerPrompt({ country, misses, correct, hidden }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  function position() {
    const element = ref.current;
    const point = pointer.current;
    if (!element || !point) return;
    const { width, height } = element.getBoundingClientRect();
    const x = Math.max(12, Math.min(point.x + 22, window.innerWidth - width - 12));
    const y = point.y + height + 28 > window.innerHeight ? point.y - height - 18 : point.y + 24;
    element.style.left = `${x}px`;
    element.style.top = `${Math.max(12, y)}px`;
  }

  useLayoutEffect(position, [country, misses, correct]);
  useEffect(() => {
    const element = ref.current!;
    function move(event: PointerEvent) {
      if (event.pointerType === 'touch') return;
      const map = (event.target as Element)?.closest?.('[data-map-surface]');
      element.dataset.away = String(!map);
      if (!map) return;
      // Keep pointer-only state separate from React's rendered className.
      // Timer and prompt updates must never remove the floating position mode.
      element.dataset.following = 'true';
      pointer.current = { x: event.clientX, y: event.clientY };
      position();
    }
    function leave() { element.dataset.away = 'true'; }
    function dock() {
      pointer.current = null;
      delete element.dataset.following;
      delete element.dataset.away;
      element.style.removeProperty('left');
      element.style.removeProperty('top');
    }
    function focus(event: FocusEvent) {
      const target = event.target as Element;
      if (target?.closest?.('[data-country-id]') && target.matches(':focus-visible')) dock();
    }
    function key(event: KeyboardEvent) {
      if ((event.target as Element)?.closest?.('[data-country-id]')) dock();
    }
    function press(event: PointerEvent) {
      if (event.pointerType === 'touch' && (event.target as Element)?.closest?.('[data-map-surface]')) dock();
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', press);
    window.addEventListener('focusin', focus);
    window.addEventListener('keydown', key);
    window.addEventListener('resize', position);
    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', press);
      window.removeEventListener('focusin', focus);
      window.removeEventListener('keydown', key);
      window.removeEventListener('resize', position);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
    };
  }, []);

  return <div ref={ref} className={`pointer-prompt${correct ? ' correct' : ''}${hidden ? ' hidden' : ''}`}>
    <div className="prompt-main">
      <span className="country-flag" aria-hidden="true">{countryFlag(country)}</span>
      <strong>{countryName(country)}</strong>
      {correct ? <Check className="prompt-check" size={21} aria-hidden="true" /> : <span className="guess-dots" aria-label={`${misses} incorrect ${misses === 1 ? 'guess' : 'guesses'}`}>{[0, 1, 2].map(i => <i key={i} className={i < misses ? 'used' : ''} />)}</span>}
    </div>
  </div>;
}
