import { useEffect, useRef, useState } from 'react';

const BOOKMARKLET_SOURCE = `javascript:(function(){try{var t=(document.body.innerText||'').replace(/\\s+/g,' ').trim().slice(0,15000);if(t.length<60){alert('Resume Tailor: not enough text on this page to capture (just '+t.length+' chars).');return;}var ti=(document.title||'').trim();var u=location.href;var role='',company='';var m=ti.split(/\\s+(?:at|@|\\u2013|-|\\|)\\s+/);if(m.length>=2){role=m[0].trim();company=(m[1]||'').replace(/\\s*[-\\u2013|].*$/,'').trim();}var payload={text:t,url:u,title:ti,role:role,company:company};var enc=encodeURIComponent(JSON.stringify(payload));var dest='__APP_URL__#jd='+enc;window.open(dest,'_blank','noopener');}catch(e){alert('Resume Tailor capture failed: '+e.message);}})();`;

function getAppUrl(): string {
  return `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`;
}

export function BookmarkletCard() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  const code = BOOKMARKLET_SOURCE.replace('__APP_URL__', getAppUrl());

  // React strips javascript: hrefs from JSX, so we set it via ref after mount.
  useEffect(() => {
    if (linkRef.current) linkRef.current.setAttribute('href', code);
  }, [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <details
      className="card"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      style={{ marginTop: '0.75rem' }}
    >
      <summary>
        <strong>Tip:</strong> use the bookmarklet to capture LinkedIn / Workday
        / Greenhouse JDs in one click
      </summary>
      <p className="muted" style={{ marginTop: '0.5rem' }}>
        The URL fetcher can't run JavaScript, so JDs on dynamic sites often
        come back empty. The bookmarklet runs <em>in your browser</em> on the
        already-rendered page, grabs the text, and opens this app pre-filled.
      </p>

      <ol style={{ paddingLeft: '1.25rem' }}>
        <li>Show your bookmarks bar (Ctrl/Cmd + Shift + B).</li>
        <li>
          Drag this link to the bar:{' '}
          <a
            ref={linkRef}
            onClick={(e) => e.preventDefault()}
            style={{
              display: 'inline-block',
              padding: '0.25rem 0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 6,
              marginLeft: '0.25rem',
              cursor: 'grab',
              textDecoration: 'none',
            }}
          >
            📌 Tailor this JD
          </a>
        </li>
        <li>
          Open any job posting in a new tab, click the bookmarklet — this
          app opens with the JD pre-filled.
        </li>
      </ol>

      <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
        If drag-and-drop doesn't work in your browser, create a new bookmark
        manually and paste this as its URL:
      </p>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <textarea
          readOnly
          rows={3}
          value={code}
          style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" onClick={copy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </details>
  );
}
