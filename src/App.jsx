import { useCallback, useEffect, useRef, useState } from 'react';
import { Renderer } from './render/Renderer.js';
import { play, setMuted } from './render/audio.js';
import { Session } from './game/session.js';
import { attachInput, SCREEN_VECTORS } from './input/input.js';
import { LEVELS, CHAPTERS } from './levels/index.js';
import {
  loadProgress, recordCompletion, recordRestart, recordStart, isUnlocked, levelStats, summary,
} from './progress/progress.js';
import { HUD } from './ui/HUD.jsx';
import { LevelSelect } from './ui/LevelSelect.jsx';
import { WinPanel, LostToast, BriefCard } from './ui/Panels.jsx';
import { TouchPad } from './ui/TouchPad.jsx';
import { Title } from './ui/Title.jsx';
import { notesFor } from './ui/fieldNotes.js';
import { compileLevel } from './engine/level.js';

// Which mechanics each level shows for the first time (for the field notes).
const SEEN_BEFORE = (() => {
  const seen = new Set();
  return LEVELS.map((l) => {
    const before = new Set(seen);
    notesFor(compileLevel(l)).forEach((n) => seen.add(n.key));
    return before;
  });
})();

const isCoarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export default function App() {
  const stageRef = useRef(null);
  const rendererRef = useRef(null);
  const sessionRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [progress, setProgress] = useState(loadProgress);
  const [levelIndex, setLevelIndex] = useState(() => {
    const p = loadProgress();
    const i = LEVELS.findIndex((l) => l.id === p.lastLevel);
    return i >= 0 ? i : 0;
  });
  const [screen, setScreen] = useState('title'); // title | play
  const [selectOpen, setSelectOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(true);
  const [win, setWin] = useState(null);
  const [muted, setMutedState] = useState(false);
  const [showPad, setShowPad] = useState(isCoarse);
  const [notes, setNotes] = useState([]);

  const def = LEVELS[levelIndex];
  const chapter = CHAPTERS.find((c) => c.n === def.chapter);

  // --- renderer + session lifetime ---------------------------------------------
  useEffect(() => {
    const r = new Renderer(stageRef.current, { onSound: play });
    rendererRef.current = r;
    sessionRef.current = new Session(r, setSnap);
    // Debug/testing hook (harmless in production): window.__architect.session
    window.__architect = { session: sessionRef.current, renderer: r, goto: (i) => setLevelIndex(i) };
    return () => r.dispose();
  }, []);

  const loadLevel = useCallback((i) => {
    const s = sessionRef.current;
    s.load(LEVELS[i]);
    setNotes(notesFor(s.level).map((n) => ({ ...n, isNew: !SEEN_BEFORE[i].has(n.key) })));
    setWin(null);
    setBriefOpen(true);
    setProgress((p) => recordStart(p, LEVELS[i].id));
  }, []);

  useEffect(() => {
    loadLevel(levelIndex);
  }, [levelIndex, loadLevel]);

  // --- win detection -------------------------------------------------------------
  useEffect(() => {
    if (!snap || snap.status !== 'won' || win) return;
    const s = sessionRef.current;
    const res = recordCompletion(progress, def.id, { moves: snap.moves, time: s.elapsed(), optimal: def.optimal });
    setProgress(res.progress);
    const t = setTimeout(() => {
      setWin({ moves: snap.moves, time: s.elapsed(), restarts: snap.restarts, newBestMoves: res.newBestMoves, newBestTime: res.newBestTime });
    }, 950);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.status]);

  // --- actions -------------------------------------------------------------------
  const nextLevel = useCallback(() => {
    if (levelIndex < LEVELS.length - 1) setLevelIndex(levelIndex + 1);
    else {
      setWin(null);
      setSelectOpen(true);
    }
  }, [levelIndex]);

  const doRestart = useCallback(() => {
    if (sessionRef.current.restart()) setProgress((p) => recordRestart(p, def.id));
    setWin(null);
  }, [def.id]);

  const handleIntent = useCallback(
    (it) => {
      const s = sessionRef.current;
      const r = rendererRef.current;
      if (!s || !r) return;
      if (screen === 'title') {
        if (it.type === 'confirm' || (it.type === 'move' && !it.vector)) setScreen('play');
        return;
      }
      if (selectOpen) {
        if (it.type === 'menu') setSelectOpen(false);
        return;
      }
      if (win) {
        if (it.type === 'confirm') nextLevel();
        else if (it.type === 'restart') doRestart();
        else if (it.type === 'undo') {
          s.undo();
          setWin(null);
        } else if (it.type === 'menu') setSelectOpen(true);
        return;
      }
      switch (it.type) {
        case 'move': {
          if (it.repeat && r.busy) return;
          const v = it.vector || SCREEN_VECTORS[it.dir];
          const dir = r.vectorToGrid(v);
          if (dir && s.move(dir)) setBriefOpen(false);
          break;
        }
        case 'wait':
          if (s.hasTime && s.wait()) setBriefOpen(false);
          break;
        case 'undo':
          s.undo();
          break;
        case 'restart':
          doRestart();
          break;
        case 'swap':
          s.swap();
          play('ui');
          break;
        case 'menu':
          setSelectOpen(true);
          break;
        case 'notes':
          setBriefOpen((b) => !b);
          break;
        default:
      }
    },
    [screen, selectOpen, win, nextLevel, doRestart],
  );

  const intentRef = useRef(handleIntent);
  intentRef.current = handleIntent;
  useEffect(() => attachInput(stageRef.current, (it) => intentRef.current(it)), []);

  // tick the clock display
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);

  const stats = levelStats(progress, def.id);
  const sum = summary(progress, LEVELS);
  const time = sessionRef.current?.elapsed() ?? 0;

  return (
    <div className={`app ${screen}`}>
      <div className="stage" ref={stageRef} />
      <div className="vignette" />

      {screen === 'title' && (
        <Title
          summary={sum}
          hasProgress={sum.done > 0}
          onStart={() => {
            play('ui');
            setScreen('play');
          }}
          onSelect={() => {
            setScreen('play');
            setSelectOpen(true);
          }}
        />
      )}

      {screen === 'play' && snap && (
        <>
          <HUD
            def={def}
            chapter={chapter}
            levelIndex={levelIndex}
            levels={LEVELS}
            progress={progress}
            snap={snap}
            time={time}
            stats={stats}
            muted={muted}
            onUndo={() => handleIntent({ type: 'undo' })}
            onRestart={() => handleIntent({ type: 'restart' })}
            onWait={() => handleIntent({ type: 'wait' })}
            onSwap={() => handleIntent({ type: 'swap' })}
            onMenu={() => setSelectOpen(true)}
            onNotes={() => setBriefOpen((b) => !b)}
            onMute={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
            onTogglePad={() => setShowPad((v) => !v)}
            padOn={showPad}
            onJump={(i) => isUnlocked(progress, LEVELS, i) && setLevelIndex(i)}
          />
          {briefOpen && !win && <BriefCard def={def} notes={notes} onClose={() => setBriefOpen(false)} />}
          {snap.status === 'lost' && (
            <LostToast lost={snap.lost} onUndo={() => handleIntent({ type: 'undo' })} onRestart={() => handleIntent({ type: 'restart' })} />
          )}
          {showPad && !win && (
            <TouchPad
              onMove={(d) => handleIntent({ type: 'move', dir: d })}
              onWait={snap.hasTime ? () => handleIntent({ type: 'wait' }) : null}
              onSwap={snap.blocks > 1 ? () => handleIntent({ type: 'swap' }) : null}
            />
          )}
          {win && (
            <WinPanel
              def={def}
              win={win}
              stats={levelStats(progress, def.id)}
              isLast={levelIndex === LEVELS.length - 1}
              onNext={nextLevel}
              onReplay={doRestart}
              onMenu={() => setSelectOpen(true)}
            />
          )}
        </>
      )}

      {selectOpen && (
        <LevelSelect
          chapters={CHAPTERS}
          levels={LEVELS}
          progress={progress}
          current={levelIndex}
          summary={sum}
          onPick={(i) => {
            setSelectOpen(false);
            setScreen('play');
            if (i === levelIndex) loadLevel(i);
            else setLevelIndex(i);
          }}
          onClose={() => setSelectOpen(false)}
          onProgressReset={(p) => setProgress(p)}
        />
      )}
    </div>
  );
}
