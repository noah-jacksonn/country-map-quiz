import { countries, countryById } from './data/countries.ts';
import { isMapTheme } from './themes.ts';
import type { MapTheme } from './themes.ts';

export type Answer = { id: string; misses: number; assisted: boolean };
export type Game = {
  id: string; mode: 'quiz' | 'practice'; order: string[]; answers: Answer[];
  misses: number; guesses: number; elapsed: number; started: boolean;
};
export type Attempt = {
  id: string; date: number; answers: Answer[]; total: number;
  guesses: number; elapsed: number; complete: boolean; mistakes?: string[];
};
export type Profile = { version: 2; mistakes: string[]; history: Attempt[]; active: Game; sound: boolean; theme: MapTheme };
// Keep the original key so existing rounds and history migrate in place.
export const STORAGE_KEY = 'country-map-quiz.v1';

export function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function newGame(mode: Game['mode'] = 'quiz', ids: string[] = countries.map(c => c.id)): Game {
  return { id: crypto.randomUUID(), mode, order: shuffle(ids), answers: [], misses: 0, guesses: 0, elapsed: 0, started: false };
}

export const isComplete = (game: Game) => game.answers.length === game.order.length;
export const accuracy = (answers: number, guesses: number) => guesses ? Math.round(answers / guesses * 100) : 100;
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function answerMistakes(answers: Answer[]): string[] {
  return answers.filter(answer => answer.misses > 0 || answer.assisted).map(answer => answer.id);
}

export function roundMistakes(game: Game): string[] {
  const target = game.order[game.answers.length];
  return [...new Set([...answerMistakes(game.answers), ...(game.misses > 0 && target ? [target] : [])])];
}

export function attemptMistakes(attempt: Attempt): string[] {
  return [...new Set([...answerMistakes(attempt.answers), ...(attempt.mistakes ?? [])])];
}

export function archive(profile: Profile, game: Game): Attempt[] {
  if (game.mode !== 'quiz' || !game.guesses) return profile.history;
  if (profile.history.some(attempt => attempt.id === game.id)) return profile.history;
  const attempt = { id: game.id, date: Date.now(), answers: game.answers, total: game.order.length,
    guesses: game.guesses, elapsed: game.elapsed, complete: isComplete(game), mistakes: roundMistakes(game) };
  return [attempt, ...profile.history.filter(item => item.id !== game.id)];
}

export function startGame(profile: Profile, mode: Game['mode'] = 'quiz', ids?: string[]): Profile {
  return { ...profile, active: newGame(mode, ids),
    // Completed rounds were already archived on the final answer. Don't restore deleted attempts.
    history: isComplete(profile.active) ? profile.history : archive(profile, profile.active) };
}

export function answerCountry(profile: Profile, id: string): Profile {
  const game = profile.active;
  if (isComplete(game) || game.answers.some(answer => answer.id === id) || !game.order.includes(id)) return profile;
  const target = game.order[game.answers.length];
  if (id !== target) return { ...profile,
    mistakes: profile.mistakes.includes(target) ? profile.mistakes : [...profile.mistakes, target],
    active: { ...game, guesses: game.guesses + 1, misses: game.misses + 1, started: true } };
  const answer: Answer = { id, misses: game.misses, assisted: game.misses >= 3 };
  const active = { ...game, answers: [...game.answers, answer], guesses: game.guesses + 1, misses: 0, started: true };
  return {
    ...profile, active,
    history: isComplete(active) ? archive(profile, active) : profile.history,
  };
}

function validIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(id => typeof id === 'string' && countryById.has(id)) && new Set(value).size === value.length;
}
function nonnegative(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0; }
function validAnswers(value: unknown): value is Answer[] {
  return Array.isArray(value) && value.every(a => a && countryById.has(a.id) && nonnegative(a.misses) && typeof a.assisted === 'boolean')
    && new Set(value.map(a => a.id)).size === value.length;
}
function validGame(value: unknown): value is Game {
  if (!value || typeof value !== 'object') return false;
  const g = value as Game;
  return typeof g.id === 'string' && ['quiz', 'practice'].includes(g.mode) && validIds(g.order) && g.order.length > 0
    && validAnswers(g.answers) && g.answers.every((answer, index) => answer.id === g.order[index])
    && nonnegative(g.misses) && nonnegative(g.guesses) && g.guesses >= g.answers.length && nonnegative(g.elapsed) && typeof g.started === 'boolean';
}
function validAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== 'object') return false;
  const a = value as Attempt;
  return typeof a.id === 'string' && nonnegative(a.date) && validAnswers(a.answers) && nonnegative(a.total)
    && a.total <= 48 && a.total >= a.answers.length && nonnegative(a.guesses) && a.guesses >= a.answers.length
    && nonnegative(a.elapsed) && typeof a.complete === 'boolean' && (a.mistakes === undefined || validIds(a.mistakes));
}

export function readProfile(): Profile {
  const fallback: Profile = { version: 2, mistakes: [], history: [], active: newGame(), sound: true, theme: 'ocean' };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object' || !('version' in saved) || (saved.version !== 1 && saved.version !== 2)) return fallback;
    const legacy = saved.version === 1;
    const p = saved as Profile;
    const history = Array.isArray(p.history) ? p.history.filter(validAttempt) : [];
    const active = validGame(p.active) ? p.active : fallback.active;
    const mistakes = [...new Set([
      ...(validIds(p.mistakes) ? p.mistakes : []), ...history.flatMap(attemptMistakes), ...roundMistakes(active),
    ])];
    // Old practice rounds used known countries. Replace only those rounds;
    // preserve current quizzes and the complete attempt history.
    return { version: 2, mistakes, history,
      active: legacy && active.mode === 'practice'
        ? (mistakes.length ? newGame('practice', mistakes) : newGame()) : active,
      sound: typeof p.sound === 'boolean' ? p.sound : true,
      theme: isMapTheme(p.theme) ? p.theme : fallback.theme };
  } catch { return fallback; }
}
