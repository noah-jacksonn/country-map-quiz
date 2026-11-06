import { useEffect, useLayoutEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { countryFlag, countryName } from '../data/countries';

type Props = { country: string; misses: number; correct: boolean; hidden: boolean; wrong: string | null };

export function PointerPrompt({ country, misses, correct, hidden, wrong }: Props) {
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

  useLayoutEffect(position, [country, misses, correct, wrong]);
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
    function focus(event: FocusEvent) {
      if (!(event.target as Element)?.closest?.('[data-country-id]') || pointer.current) return;
      element.dataset.away = 'false';
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('focusin', focus);
    window.addEventListener('resize', position);
    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('focusin', focus);
      window.removeEventListener('resize', position);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
    };
  }, []);

  return <div ref={ref} className={`pointer-prompt surface${correct ? ' correct' : ''}${hidden ? ' hidden' : ''}`}>
    <div className="prompt-main">
      <span className="country-flag" aria-hidden="true">{countryFlag(country)}</span>
      <span>{correct ? '' : 'Click on '}<strong>{countryName(country)}</strong></span>
      {correct ? <Check size={15} /> : misses > 0 && <span className="guess-dots" aria-label={`${misses} incorrect guesses`}>{[0, 1, 2].map(i => <i key={i} className={i < misses ? 'used' : ''} />)}</span>}
    </div>
    {wrong && <div className="prompt-feedback">That’s {countryFlag(wrong)} {countryName(wrong)}</div>}
    {misses >= 3 && !correct && !wrong && <span className="prompt-hint">Highlighted for you</span>}
  </div>;
}
