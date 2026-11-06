import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronRight, Clock3, History, Infinity as InfinityIcon, Palette, RotateCcw, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { QuizMap } from './components/QuizMap';
import { PointerPrompt } from './components/PointerPrompt';
import { countryFlag, countryName } from './data/countries';
import { accuracy, answerCountry, attemptMistakes, formatTime, isComplete, readProfile, roundMistakes, startGame, STORAGE_KEY } from './game';
import type { Attempt, Game } from './game';
import { playAnswer } from './sound';
import { themes } from './themes';
import { useTheme } from 'next-themes';
import './App.css';

function Modal({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-content">
      <div className="modal-heading"><h1>{title}</h1><button className="icon-button close-button" onClick={onClose} aria-label="Close" title="Close"><X size={20} /></button></div>
      {children}
    </div>
  </dialog>;
}

export default function App() {
  const appRef = useRef<HTMLElement>(null);
  const [profile, setProfile] = useState(readProfile);
  const [historyCount, setHistoryCount] = useState(30);
  const [deletedAttempts, setDeletedAttempts] = useState<Attempt[]>([]);
  const { setTheme } = useTheme();
  const mapTheme = profile.theme ?? 'ocean';
  const [modal, setModal] = useState<'practice' | 'history' | 'restart' | 'complete' | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [wrong, setWrong] = useState<{ id: string; key: number } | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const locked = useRef(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const game = profile.active;
  const complete = isComplete(game);
  const target = game.order[game.answers.length];
  const score = accuracy(game.answers.length, game.guesses);
  const currentMistakes = roundMistakes(game);

  useEffect(() => {
    setTheme(mapTheme === 'paper' ? 'light' : 'dark');
    if (appRef.current) {
      const color = getComputedStyle(appRef.current).getPropertyValue('--ocean').trim();
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    }
  }, [mapTheme, setTheme]);
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.storageArea !== localStorage || (event.key !== STORAGE_KEY && event.key !== null)) return;
      const latest = readProfile();
      const current = profileRef.current;
      if (latest.active.id !== current.active.id || latest.active.guesses !== current.active.guesses) {
        clearTimeout(flashTimer.current); locked.current = false;
        setFlash(null); setWrong(null);
      }
      if (latest.active.id !== current.active.id) setModal(null);
      if (latest.history.length !== current.history.length || latest.history.some((attempt, index) => attempt.id !== current.history[index]?.id)) {
        setDeletedAttempts([]);
      }
      profileRef.current = latest;
      setProfile(latest);
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); setStorageBlocked(false); }
    catch { setStorageBlocked(true); }
  }, [profile]);
  useEffect(() => {
    if (!game.started || game.mode === 'practice' || complete || modal) return;
    const interval = setInterval(() => {
      // Only the focused window advances the shared round when several copies are open.
      if (document.visibilityState === 'visible' && document.hasFocus()) setProfile(previous => ({ ...previous, active: { ...previous.active, elapsed: previous.active.elapsed + 1 } }));
    }, 1000);
    return () => clearInterval(interval);
  }, [game.started, game.mode, complete, modal]);
  useEffect(() => {
    if (!complete) return;
    const timeout = setTimeout(() => setModal('complete'), 750);
    return () => clearTimeout(timeout);
  }, [complete, game.id]);
  useEffect(() => {
    if (!wrong) return;
    const timeout = setTimeout(() => setWrong(null), 2000);
    return () => clearTimeout(timeout);
  }, [wrong]);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const guess = useCallback((id: string) => {
    const current = profileRef.current;
    const round = current.active;
    if (locked.current || isComplete(round) || round.answers.some(a => a.id === id) || !round.order.includes(id)) return;
    const correct = id === round.order[round.answers.length];
    if (current.sound) playAnswer(correct);
    const next = answerCountry(current, id);
    profileRef.current = next;
    setProfile(next);
    if (correct) {
      setWrong(null); setFlash(id); locked.current = true;
      flashTimer.current = setTimeout(() => { setFlash(null); locked.current = false; }, 650);
    } else setWrong({ id, key: Date.now() });
  }, []);

  function start(mode: Game['mode'], ids?: string[]) {
    if (mode === 'practice' && !ids?.length) return;
    clearTimeout(flashTimer.current); locked.current = false;
    setFlash(null); setWrong(null);
    setProfile(previous => startGame(previous, mode, ids));
    setModal(null);
  }

  function deleteAttempts(ids: string[]) {
    const selected = new Set(ids);
    setDeletedAttempts(profile.history.filter(attempt => selected.has(attempt.id)));
    setProfile(previous => ({ ...previous, history: previous.history.filter(attempt => !selected.has(attempt.id)) }));
  }

  function undoDelete() {
    setProfile(previous => ({ ...previous, history: [
      ...previous.history, ...deletedAttempts.filter(attempt => !previous.history.some(saved => saved.id === attempt.id)),
    ].sort((a, b) => b.date - a.date) }));
    setDeletedAttempts([]);
  }

  return <main ref={appRef} className="app" data-theme={mapTheme}>
    <QuizMap answers={game.answers} included={game.order} revealed={game.misses >= 3 ? target : null} flash={flash} onGuess={guess} wrong={wrong?.id ?? null} />
    <header className="game-toolbar">
      <div className="scoreboard surface" aria-label="Round progress">
        {game.mode === 'quiz' ? <span className="accuracy" title="Accuracy: countries found ÷ total guesses">{score}<small>%</small></span> : <span title="Free practice: no timer or score"><InfinityIcon size={22} className="practice-icon" aria-label="Free practice" /></span>}
        <span className="toolbar-divider" />
        <span className="progress" title={`${game.answers.length} of ${game.order.length} countries found`}><strong>{game.answers.length}</strong><span>/ {game.order.length}</span></span>
        {game.mode === 'quiz' && <><span className="toolbar-divider" /><span className="timer" title="Time spent on this round"><Clock3 size={14} />{formatTime(game.elapsed)}</span></>}
      </div>
      <nav className="actions surface" aria-label="Game options">
        <button className={`practice-button${game.mode === 'practice' ? ' selected' : ''}`} aria-label="Practice mistakes" title="Practice countries you missed" onClick={() => setModal('practice')}><InfinityIcon size={18} /></button>
        <button className="icon-button" aria-label="Choose theme" title="Choose theme" popoverTarget="theme-picker"><Palette size={17} /></button>
        <button className="icon-button" aria-label="Past attempts" title="Past attempts" onClick={() => setModal('history')}><History size={18} /></button>
        <button className="icon-button" aria-label={profile.sound ? 'Mute sound effects' : 'Unmute sound effects'} title={profile.sound ? 'Mute sound effects' : 'Unmute sound effects'} aria-pressed={!profile.sound} onClick={() => setProfile(previous => ({ ...previous, sound: !previous.sound }))}>{profile.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <button className="icon-button" aria-label="New quiz" title="New quiz" onClick={() => game.guesses && !complete ? setModal('restart') : start('quiz')}><RotateCcw size={17} /></button>
      </nav>
    </header>
    <div id="theme-picker" popover="auto" className="theme-picker" aria-label="Map theme">
      {themes.map(theme => <button key={theme.id} className="theme-option" aria-pressed={mapTheme === theme.id} title={`Use ${theme.name} theme`}
        onClick={() => setProfile(previous => ({ ...previous, theme: theme.id }))}>
        <span className="theme-swatch" data-theme={theme.id}><i /><i /><i /></span>
        <span>{theme.name}</span>{mapTheme === theme.id && <Check size={14} />}
      </button>)}
    </div>
    <PointerPrompt country={flash ?? target ?? ''} misses={game.misses} correct={!!flash} hidden={!!modal || (complete && !flash)} />
    {wrong && !modal && <div key={wrong.key} className="wrong-feedback" aria-hidden="true">
      <X className="wrong-feedback-icon" size={18} aria-hidden="true" />
      <span>That’s</span><span className="country-flag" aria-hidden="true">{countryFlag(wrong.id)}</span><strong>{countryName(wrong.id)}</strong>
    </div>}
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{flash ? `Correct. ${countryName(flash)}.` : complete ? 'Round complete.' : `${wrong ? `That’s ${countryName(wrong.id)}. ${game.misses} incorrect ${game.misses === 1 ? 'guess' : 'guesses'}. ` : ''}${countryName(target)}.${game.misses >= 3 ? ' Follow the pulsing country.' : ''}`}</div>
    {storageBlocked && <p className="storage-notice">Browser storage is unavailable. This round won’t be saved.</p>}
    {complete && !modal && <button className="finish-button surface" title="View round results" onClick={() => setModal('complete')}>Round complete <ChevronRight size={17} /></button>}

    {modal === 'practice' && <Modal title="Practice" onClose={() => setModal(null)}>
      <p className="modal-description">{profile.mistakes.length ? 'Countries you missed. No timer or score.' : 'No mistakes yet.'}</p>
      {profile.mistakes.length > 0 && <div className="practice-count"><strong>{profile.mistakes.length}</strong><span>{profile.mistakes.length === 1 ? 'country ready' : 'countries ready'}</span></div>}
      {profile.mistakes.length ? <><div className="country-list">{[...profile.mistakes].sort((a, b) => countryName(a).localeCompare(countryName(b))).map(id => <span key={id}>{countryName(id)}</span>)}</div>
        <button className="primary-button" title="Practice your mistakes without a timer or score" onClick={() => start('practice', profile.mistakes)}>Start practicing <ChevronRight size={17} /></button>
      </> : <button className="primary-button" title="Return to your current round" onClick={() => setModal(null)}>Back to the map <ChevronRight size={17} /></button>}
      {game.mode === 'practice' && <button className="text-button" title="Start a quiz with all 48 countries" onClick={() => start('quiz')}>Back to the full quiz</button>}
    </Modal>}

    {modal === 'history' && <Modal title="Past attempts" className="history-modal" onClose={() => setModal(null)}>
      {!profile.history.length ? <div className="empty-history"><History size={27} /><p>Fresh start.</p></div> : <div className="history-list" tabIndex={0} role="region" aria-label="Saved attempts">{profile.history.slice(0, historyCount).map(attempt => {
        const missed = attemptMistakes(attempt);
        return <div className="history-row" key={attempt.id}>
          <span className="history-score" title="Accuracy: countries found ÷ total guesses">{accuracy(attempt.answers.length, attempt.guesses)}<small>%</small></span>
          <div className="history-detail"><strong>{attempt.answers.length} / {attempt.total} countries <span>{attempt.complete ? 'Complete' : 'Partial'}</span></strong><p>{new Date(attempt.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(attempt.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {formatTime(attempt.elapsed)}</p></div>
          <div className="history-actions">
            <button className="icon-button" disabled={!missed.length} aria-label={`Practice ${missed.length} missed countries from this attempt`} title={missed.length ? `Practice ${missed.length} missed countries` : 'No mistakes in this attempt'} onClick={() => start('practice', missed)}><InfinityIcon size={18} /></button>
            <button className="icon-button delete-attempt" aria-label={`Delete attempt from ${new Date(attempt.date).toLocaleString()}`} title="Delete attempt" onClick={() => deleteAttempts([attempt.id])}><Trash2 size={16} /></button>
          </div>
        </div>;
      })}{profile.history.length > historyCount && <button className="text-button" title="Show 30 more attempts" onClick={() => setHistoryCount(count => count + 30)}>Show more</button>}</div>}
      {(profile.history.length > 0 || deletedAttempts.length > 0) && <div className="history-footer">
        {deletedAttempts.length > 0 && <button className="text-button" title="Undo the last deletion" onClick={undoDelete}>Undo</button>}
        {profile.history.length > 0 && <button className="text-button clear-history" title="Delete all past attempts" onClick={() => deleteAttempts(profile.history.map(attempt => attempt.id))}>Clear all</button>}
      </div>}
    </Modal>}

    {modal === 'restart' && <Modal title="New quiz?" onClose={() => setModal(null)}>
      <button className="primary-button" title="Save this attempt and start a new quiz" onClick={() => start('quiz')}>New quiz <RotateCcw size={17} /></button>
      <button className="text-button" title="Continue your current round" onClick={() => setModal(null)}>Keep going</button>
    </Modal>}

    {modal === 'complete' && <Modal title={game.mode === 'practice' ? 'Practice complete' : 'Round complete'} onClose={() => setModal(null)}>
      <p className="modal-description">{game.order.length} countries.</p>
      {game.mode === 'quiz' && <div className="result-stats"><div title="Countries found ÷ total guesses"><strong>{score}<small>%</small></strong><span>Accuracy</span></div><div title="Countries found without a wrong guess"><strong>{game.answers.filter(a => a.misses === 0).length}</strong><span>First try</span></div><div title="Time spent on this round"><strong>{formatTime(game.elapsed)}</strong><span>Time</span></div></div>}
      <button className="primary-button" title={game.mode === 'practice' ? 'Practice these countries again' : 'Start a fresh 48-country quiz'} onClick={() => start(game.mode, game.mode === 'practice' ? game.order : undefined)}>{game.mode === 'practice' ? 'Keep practicing' : 'Play again'} <RotateCcw size={17} /></button>
      {game.mode === 'quiz' && currentMistakes.length > 0 && <button className="text-button" title="Practice countries you missed in this round" onClick={() => start('practice', currentMistakes)}>Practice mistakes</button>}
      <button className="text-button subtle" title="Return to your completed map" onClick={() => setModal(null)}>Look at your map</button>
    </Modal>}
  </main>;
}
