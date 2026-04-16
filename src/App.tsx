/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, Save, Trash2, Clock, Volume2, Headphones, Activity, RotateCcw, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { audioEngine } from './lib/audio';
import { cn } from './lib/utils';

interface SavedSetting {
  id: string;
  name: string;
  leftFreq: number;
  rightFreq: number;
  createdAt: number;
}

const TIMER_OPTIONS = [5, 10, 30, 60];

export default function App() {
  const [leftFreq, setLeftFreq] = useState<string>('440.00');
  const [rightFreq, setRightFreq] = useState<string>('444.00');
  const [isPlayingLeft, setIsPlayingLeft] = useState(false);
  const [isPlayingRight, setIsPlayingRight] = useState(false);
  const [savedSettings, setSavedSettings] = useState<SavedSetting[]>([]);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // PWA Install logic
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem('binaural_settings');
    if (saved) {
      setSavedSettings(JSON.parse(saved));
    }
  }, []);

  // Save settings to localStorage
  const saveToLocalStorage = (settings: SavedSetting[]) => {
    localStorage.setItem('binaural_settings', JSON.stringify(settings));
    setSavedSettings(settings);
  };

  const handleSave = () => {
    const newSetting: SavedSetting = {
      id: crypto.randomUUID(),
      name: '',
      leftFreq: parseFloat(leftFreq),
      rightFreq: parseFloat(rightFreq),
      createdAt: Date.now(),
    };
    saveToLocalStorage([newSetting, ...savedSettings]);
  };

  const handleDelete = (id: string) => {
    saveToLocalStorage(savedSettings.filter(s => s.id !== id));
  };

  const validateFreq = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return 20;
    return Math.min(Math.max(num, 20), 2000);
  };

  const formatFreq = (val: string) => {
    // Ensure 2 decimal places and no auto-completion while typing
    return val;
  };

  const toggleLeft = () => {
    setActivePresetId(null);
    if (isPlayingLeft) {
      audioEngine.stopLeft();
      setIsPlayingLeft(false);
    } else {
      audioEngine.startLeft(parseFloat(leftFreq));
      setIsPlayingLeft(true);
    }
  };

  const toggleRight = () => {
    setActivePresetId(null);
    if (isPlayingRight) {
      audioEngine.stopRight();
      setIsPlayingRight(false);
    } else {
      audioEngine.startRight(parseFloat(rightFreq));
      setIsPlayingRight(true);
    }
  };

  const toggleBoth = () => {
    if (isPlayingLeft || isPlayingRight) {
      stopAll();
    } else {
      audioEngine.start(parseFloat(leftFreq), parseFloat(rightFreq));
      setIsPlayingLeft(true);
      setIsPlayingRight(true);
    }
  };

  const startTimer = (minutes: number, id?: string) => {
    clearTimer();
    setTimerRemaining(minutes * 60);
    setActiveTimerId(id || 'manual');
    
    timerRef.current = setInterval(() => {
      setTimerRemaining(prev => {
        if (prev === null || prev <= 1) {
          stopAll();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerRemaining(null);
    setActiveTimerId(null);
  };

  const stopAll = useCallback(() => {
    audioEngine.stop();
    setIsPlayingLeft(false);
    setIsPlayingRight(false);
    setActivePresetId(null);
    clearTimer();
  }, []);

  // Media Session API for background control and notification
  useEffect(() => {
    if ('mediaSession' in navigator) {
      const diff = Math.abs(parseFloat(leftFreq) - parseFloat(rightFreq)).toFixed(2);
      const timerText = timerRemaining !== null ? ` | Timer: ${formatTime(timerRemaining)}` : '';
      
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Binaural Beat: ${diff} Hz`,
        artist: `Binaural Beats Generator${timerText}`,
        album: `L: ${leftFreq}Hz | R: ${rightFreq}Hz`,
        artwork: [
          { src: 'BBG.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        audioEngine.start(parseFloat(leftFreq), parseFloat(rightFreq));
        setIsPlayingLeft(true);
        setIsPlayingRight(true);
      });

      navigator.mediaSession.setActionHandler('pause', stopAll);
      navigator.mediaSession.setActionHandler('stop', stopAll);
    }
  }, [leftFreq, rightFreq, stopAll, timerRemaining]);

  // Update frequencies in real-time if playing
  useEffect(() => {
    if (isPlayingLeft || isPlayingRight) {
      audioEngine.updateFrequencies(parseFloat(leftFreq), parseFloat(rightFreq));
    }
  }, [leftFreq, rightFreq, isPlayingLeft, isPlayingRight]);

  const diffFreq = Math.abs(parseFloat(leftFreq) - parseFloat(rightFreq)).toFixed(2);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center gap-8 max-w-2xl mx-auto bg-black text-white">
      <div className="w-full text-center space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
          Frequency Range: 20Hz — 2000Hz
        </p>
        
        <AnimatePresence>
          {deferredPrompt && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={handleInstallClick}
              className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-[10px] font-mono uppercase tracking-wider transition-colors"
            >
              <Download size={12} />
              Install App
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Main Controls */}
      <div className="hardware-card w-full p-6 space-y-8">
        <div className="grid grid-cols-2 gap-6">
          {/* Left Ear */}
          <div className="space-y-4">
            <label className="text-xs font-mono uppercase text-gray-600 block">Left (L)</label>
            <div className="lcd-display p-4 text-center">
              <input
                type="number"
                step="0.01"
                min="20"
                max="2000"
                autoComplete="off"
                value={leftFreq}
                onChange={(e) => {
                  setLeftFreq(e.target.value);
                  setActivePresetId(null);
                }}
                onBlur={(e) => setLeftFreq(validateFreq(e.target.value).toFixed(2))}
                className="w-full bg-transparent text-2xl text-center focus:outline-none text-white"
              />
              <span className="text-[10px] block opacity-50">Hz</span>
            </div>
            <button
              onClick={toggleLeft}
              className={cn(
                "w-full py-3 rounded-md font-bold transition-all flex items-center justify-center gap-2 border",
                isPlayingLeft ? "bg-white text-black border-white" : "bg-transparent text-white border-gray-700 hover:border-white"
              )}
            >
              {isPlayingLeft ? <Square size={18} /> : <Play size={18} />}
              {isPlayingLeft ? "STOP L" : "PLAY L"}
            </button>
          </div>

          {/* Right Ear */}
          <div className="space-y-4">
            <label className="text-xs font-mono uppercase text-gray-600 block">Right (R)</label>
            <div className="lcd-display p-4 text-center">
              <input
                type="number"
                step="0.01"
                min="20"
                max="2000"
                autoComplete="off"
                value={rightFreq}
                onChange={(e) => {
                  setRightFreq(e.target.value);
                  setActivePresetId(null);
                }}
                onBlur={(e) => setRightFreq(validateFreq(e.target.value).toFixed(2))}
                className="w-full bg-transparent text-2xl text-center focus:outline-none text-white"
              />
              <span className="text-[10px] block opacity-50">Hz</span>
            </div>
            <button
              onClick={toggleRight}
              className={cn(
                "w-full py-3 rounded-md font-bold transition-all flex items-center justify-center gap-2 border",
                isPlayingRight ? "bg-white text-black border-white" : "bg-transparent text-white border-gray-700 hover:border-white"
              )}
            >
              {isPlayingRight ? <Square size={18} /> : <Play size={18} />}
              {isPlayingRight ? "STOP R" : "PLAY R"}
            </button>
          </div>
        </div>

        {/* Difference Display */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] font-mono uppercase text-gray-600">BEAT</div>
          <div className="text-4xl font-mono text-white font-bold">{diffFreq} Hz</div>
        </div>

        {/* Master Controls */}
        <div className="flex gap-4">
          <button
            onClick={toggleBoth}
            className={cn(
              "flex-1 py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-3 border-2",
              (isPlayingLeft || isPlayingRight) 
                ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                : "bg-transparent text-white border-white hover:bg-white hover:text-black"
            )}
          >
            {(isPlayingLeft || isPlayingRight) ? <Square fill="currentColor" /> : <Play fill="currentColor" />}
            {(isPlayingLeft || isPlayingRight) ? "STOP" : "START"}
          </button>
          <button
            onClick={handleSave}
            className="p-4 hardware-card hover:bg-white hover:text-black transition-colors"
            title="Save"
          >
            <Save size={24} />
          </button>
          <button
            onClick={() => {
              setLeftFreq('440.00');
              setRightFreq('444.00');
            }}
            className="p-4 hardware-card hover:bg-white hover:text-black transition-colors"
            title="Reset Frequencies"
          >
            <RotateCcw size={24} />
          </button>
        </div>

        {/* Timer Display */}
        <AnimatePresence>
          {timerRemaining !== null && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center justify-center gap-4 pt-4 border-t border-gray-800"
            >
              <Clock className="text-white animate-pulse" size={20} />
              <span className="font-mono text-xl">{formatTime(timerRemaining)}</span>
              <button onClick={clearTimer} className="text-xs text-gray-400 uppercase font-bold hover:text-white hover:underline">Cancel</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Saved Presets */}
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-mono uppercase text-gray-600 flex items-center gap-2">
            <Headphones size={14} /> SAVED
          </h2>
        </div>
        <div className="space-y-3">
          {savedSettings.length === 0 && (
            <div className="text-center py-8 text-gray-800 italic text-sm">No saved items.</div>
          )}
          {savedSettings.map((setting) => (
            <motion.div
              key={setting.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="hardware-card p-4 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-gray-600">
                    L: {setting.leftFreq.toFixed(2)}Hz | R: {setting.rightFreq.toFixed(2)}Hz
                  </div>
                  <div className="text-[10px] font-mono uppercase text-gray-500 mt-1">
                    Beat: {Math.abs(setting.leftFreq - setting.rightFreq).toFixed(2)}Hz
                  </div>
                </div>
              </div>

              {/* Preset Timers */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <span className="text-[10px] font-mono uppercase text-gray-700 whitespace-nowrap">Timer:</span>
                {TIMER_OPTIONS.map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setLeftFreq(setting.leftFreq.toFixed(2));
                      setRightFreq(setting.rightFreq.toFixed(2));
                      audioEngine.start(setting.leftFreq, setting.rightFreq);
                      setIsPlayingLeft(true);
                      setIsPlayingRight(true);
                      setActivePresetId(setting.id);
                      startTimer(mins, setting.id);
                    }}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold border transition-all",
                      activeTimerId === setting.id && timerRemaining !== null && Math.floor(timerRemaining/60) === mins - 1
                        ? "bg-white border-white text-black"
                        : "border-gray-800 text-gray-500 hover:border-white hover:text-white"
                    )}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              {/* Play/Delete Buttons at the bottom */}
              <div className="flex gap-2 pt-2 border-t border-gray-800">
                <button
                  onClick={() => {
                    if (activePresetId === setting.id) {
                      stopAll();
                    } else {
                      setLeftFreq(setting.leftFreq.toFixed(2));
                      setRightFreq(setting.rightFreq.toFixed(2));
                      audioEngine.start(setting.leftFreq, setting.rightFreq);
                      setIsPlayingLeft(true);
                      setIsPlayingRight(true);
                      setActivePresetId(setting.id);
                    }
                  }}
                  className={cn(
                    "flex-1 py-2 rounded border transition-all flex items-center justify-center gap-2 text-xs font-bold",
                    activePresetId === setting.id 
                      ? "bg-white text-black border-white" 
                      : "border-gray-800 text-gray-400 hover:border-white hover:text-white"
                  )}
                >
                  {activePresetId === setting.id ? <Square size={14} /> : <Play size={14} />}
                  {activePresetId === setting.id ? "STOP" : "PLAY"}
                </button>
                <button
                  onClick={() => handleDelete(setting.id)}
                  className="p-2 rounded border border-gray-800 text-gray-400 hover:border-red-500 hover:text-red-500 flex items-center justify-center"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <footer className="w-full text-center py-8 text-[10px] text-gray-600 font-mono uppercase tracking-widest">
      </footer>
    </div>
  );
}
