import { useEffect, useState } from 'react';
import {
  getEffectiveTheme,
  getStoredTheme,
  setStoredTheme,
  applyTheme,
  type Theme,
} from '../lib/theme';

type Mode = Theme | 'system';

function currentMode(): Mode {
  return (getStoredTheme() as Mode | null) ?? 'system';
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(currentMode);

  useEffect(() => {
    function onChange() {
      setMode(currentMode());
    }
    window.addEventListener('theme-change', onChange);
    return () => window.removeEventListener('theme-change', onChange);
  }, []);

  function set(m: Mode) {
    if (m === 'system') {
      localStorage.removeItem('resume-tailor:theme');
      applyTheme(getEffectiveTheme());
      window.dispatchEvent(new CustomEvent('theme-change'));
    } else {
      setStoredTheme(m);
    }
    setMode(m);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      <button
        className={mode === 'light' ? 'active' : ''}
        onClick={() => set('light')}
        title="Light"
        aria-label="Light theme"
      >
        ☀
      </button>
      <button
        className={mode === 'system' ? 'active' : ''}
        onClick={() => set('system')}
        title="System"
        aria-label="System theme"
      >
        ◐
      </button>
      <button
        className={mode === 'dark' ? 'active' : ''}
        onClick={() => set('dark')}
        title="Dark"
        aria-label="Dark theme"
      >
        ☾
      </button>
    </div>
  );
}
