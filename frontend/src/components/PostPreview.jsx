import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import '../styles/PostPreview.css';

export const LIMITS = {
  instagram: { caption: 2200, hashtagCount: 30 },
  twitter:   { caption: 280,  hashtagCount: null },
  linkedin:  { caption: 3000, hashtagCount: null },
};

export function CaptionCounter({ caption, hashtags, platform }) {
  const limit = LIMITS[platform]?.caption;
  if (!limit) return null;
  const text = platform === 'twitter'
    ? [caption, hashtags].filter(Boolean).join(' ')
    : (caption || '');
  const len = text.length;
  const over = len > limit;
  const warn = !over && len > limit * 0.85;
  return (
    <span className={`char-counter${over ? ' char-counter--over' : warn ? ' char-counter--warn' : ''}`}>
      {len}/{limit}
    </span>
  );
}

export function HashtagsCounter({ hashtags, platform }) {
  if (platform === 'twitter') return null;
  const limit = LIMITS[platform]?.hashtagCount;
  if (!limit) return null;
  const tags = hashtags ? hashtags.trim().split(/\s+/).filter(t => t.startsWith('#')).length : 0;
  const over = tags > limit;
  const warn = !over && tags > limit * 0.85;
  return (
    <span className={`char-counter${over ? ' char-counter--over' : warn ? ' char-counter--warn' : ''}`}>
      {tags}/{limit} tags
    </span>
  );
}

/* ─── Instagram ──────────────────────────────────────────── */
function InstagramPreview({ caption, hashtags, imageUrl, username, dark }) {
  const [expanded, setExpanded] = useState(false);
  const fullCaption = [caption, hashtags].filter(Boolean).join('\n');
  const TRUNCATE = 125;
  const shouldTruncate = fullCaption.length > TRUNCATE && !expanded;
  const displayText = shouldTruncate ? fullCaption.slice(0, TRUNCATE) + '…' : fullCaption;
  const initial = (username || 'U').charAt(0).toUpperCase();

  const bg        = dark ? '#000000' : '#ffffff';
  const border    = dark ? '#262626' : '#dbdbdb';
  const textMain  = dark ? '#f5f5f5' : '#262626';
  const textMuted = dark ? '#a8a8a8' : '#737373';
  const divider   = dark ? '#262626' : '#efefef';
  const imgBg     = dark ? '#1a1a1a' : '#efefef';
  const avatarBg  = dark ? '#a8a8a8' : '#c7c7c7';
  const avatarBorder = dark ? '#000000' : '#ffffff';

  const no = { pointerEvents: 'none', userSelect: 'none' };
  const yes = { pointerEvents: 'auto', userSelect: 'none' };

  return (
    <div style={{ width: '100%', maxWidth: 400, background: bg, border: `1px solid ${border}`, borderRadius: 3, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", overflow: 'hidden', boxSizing: 'border-box', color: textMain, ...no }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', boxSizing: 'border-box' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: avatarBg, border: `2px solid ${avatarBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#262626', boxSizing: 'border-box' }}>{initial}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: textMain, lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username || 'your_account'}</span>
          <span style={{ fontSize: 11, color: textMuted, lineHeight: '1.2' }}>Sponsored</span>
        </div>
        <svg viewBox="0 0 24 24" width="20" height="20" fill={textMain} style={{ flexShrink: 0 }}>
          <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
        </svg>
      </div>

      {/* Image */}
      <div style={{ width: '100%', aspectRatio: '1 / 1', background: imgBg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {imageUrl
          ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke={dark ? '#555' : '#bbb'} strokeWidth="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span style={{ fontSize: 12, color: textMuted }}>No image uploaded</span>
            </div>
        }
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 4px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke={textMain} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 3px' }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke={textMain} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 3px' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke={textMain} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 3px' }}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </div>
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke={textMain} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 21 12 16 5 21 5 3 19 3 19 21"/></svg>
      </div>

      {/* Likes */}
      <div style={{ padding: '0 14px 5px', fontSize: 13.5, color: textMain, fontWeight: 600, boxSizing: 'border-box' }}>Be the first to like this</div>

      {/* Caption */}
      <div style={{ padding: '0 14px 5px', boxSizing: 'border-box' }}>
        {fullCaption
          ? <p style={{ margin: 0, padding: 0, fontSize: 13.5, lineHeight: '1.5', color: textMain, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              <strong style={{ fontWeight: 700 }}>{username || 'your_account'}</strong>
              {'  '}
              {displayText}
              {shouldTruncate && <button onClick={() => setExpanded(true)} style={{ background: 'none', border: 'none', fontSize: 13.5, color: textMuted, padding: 0, cursor: 'pointer', display: 'inline', ...yes }}>more</button>}
              {expanded && <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', fontSize: 13.5, color: textMuted, padding: 0, cursor: 'pointer', display: 'inline', marginLeft: 4, ...yes }}> less</button>}
            </p>
          : <p style={{ margin: 0, fontSize: 13.5, color: textMuted, fontStyle: 'italic' }}>Caption will appear here…</p>
        }
      </div>

      {/* View all comments */}
      <div style={{ padding: '2px 14px', fontSize: 13.5, color: textMuted, boxSizing: 'border-box' }}>View all comments</div>

      {/* Add comment bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 6px', borderTop: `1px solid ${divider}`, boxSizing: 'border-box' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: avatarBg, fontSize: 10, fontWeight: 700, color: '#262626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initial}</div>
        <span style={{ flex: 1, fontSize: 13, color: textMuted }}>Add a comment…</span>
        <span style={{ fontSize: 14, color: textMain }}>😊</span>
      </div>

      {/* Timestamp */}
      <div style={{ padding: '4px 14px 10px', fontSize: 10, color: textMuted, letterSpacing: '0.3px', textTransform: 'uppercase', boxSizing: 'border-box' }}>JUST NOW</div>
    </div>
  );
}

/* ─── Twitter / X ────────────────────────────────────────── */
function TwitterPreview({ caption, hashtags, username, dark }) {
  const fullText = [caption, hashtags].filter(Boolean).join(' ');
  const len = fullText.length;
  const over = len > 280;
  const pct = Math.min(len / 280, 1.5);
  const r = 10, circ = 2 * Math.PI * r;
  const dashLen = Math.min(pct, 1) * circ;
  const ringColor = over ? '#f4212e' : pct > 0.9 ? '#ffd400' : '#1d9bf0';
  const initial = (username || 'U').charAt(0).toUpperCase();

  const bg        = dark ? '#15202b' : '#ffffff';
  const border    = dark ? '#38444d' : '#cfd9de';
  const textMain  = dark ? '#f7f9f9' : '#0f1419';
  const textMuted = dark ? '#8b98a5' : '#536471';
  const trackColor = dark ? '#2f3336' : '#cfd9de';

  const no = { pointerEvents: 'none', userSelect: 'none' };

  return (
    <div style={{ width: '100%', maxWidth: 400, background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: '14px 16px 10px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", display: 'flex', gap: 10, boxSizing: 'border-box', ...no }}>

      {/* Left col: avatar + thread line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1d9bf0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>{initial}</div>
        <div style={{ flex: 1, width: 2, background: trackColor, marginTop: 6, borderRadius: 1, minHeight: 20 }}/>
      </div>

      {/* Right col */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Identity row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2, gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: textMain, whiteSpace: 'nowrap' }}>{username || 'Your Name'}</span>
            <svg viewBox="0 0 24 24" width="15" height="15" style={{ flexShrink: 0, marginTop: 1 }}>
              <path fill="#1d9bf0" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C2.88 9.33 2 10.57 2 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.33-2.19c1.4.46 2.91.2 3.92-.81s1.26-2.52.8-3.91C21.37 14.67 22.25 13.43 22.25 12zm-13.4 5.19L5.22 13.56l1.42-1.42 2.21 2.21 5.93-5.93 1.42 1.42-7.34 7.35z"/>
            </svg>
            <span style={{ fontSize: 13, color: textMuted, whiteSpace: 'nowrap' }}>@{username || 'your_account'}</span>
            <span style={{ fontSize: 13, color: textMuted }}>·</span>
            <span style={{ fontSize: 13, color: textMuted, whiteSpace: 'nowrap' }}>now</span>
          </div>
          <svg viewBox="0 0 24 24" width="18" height="18" style={{ flexShrink: 0 }}>
            <circle cx="5" cy="12" r="2" fill={textMuted}/><circle cx="12" cy="12" r="2" fill={textMuted}/><circle cx="19" cy="12" r="2" fill={textMuted}/>
          </svg>
        </div>

        {/* Tweet text */}
        <div style={{ fontSize: 15, lineHeight: '1.55', color: textMain, wordBreak: 'break-word', whiteSpace: 'pre-wrap', margin: '4px 0 10px', ...(over ? { border: '1.5px solid #f4212e', borderRadius: 6, padding: '4px 6px' } : {}) }}>
          {fullText || <span style={{ color: dark ? '#555' : '#aaa', fontStyle: 'italic' }}>Tweet will appear here…</span>}
        </div>

        {/* Action icons + ring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
          {[
            <path key="c" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
            <><polyline key="r1" points="17 1 21 5 17 9"/><path key="r2" d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline key="r3" points="7 23 3 19 7 15"/><path key="r4" d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
            <path key="h" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
            <><line key="s1" x1="22" y1="2" x2="11" y2="13"/><polygon key="s2" points="22 2 15 22 11 13 2 9 22 2"/></>,
          ].map((icon, i) => (
            <svg key={i} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
          ))}
          {/* Char ring */}
          <div style={{ marginLeft: 'auto', position: 'relative', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0 }}>
              <circle cx="12" cy="12" r={r} fill="none" stroke={trackColor} strokeWidth="2"/>
              <circle cx="12" cy="12" r={r} fill="none" stroke={ringColor} strokeWidth="2" strokeDasharray={`${dashLen} ${circ}`} strokeLinecap="round" transform="rotate(-90 12 12)"/>
            </svg>
            {over && <span style={{ position: 'absolute', fontSize: 9, fontWeight: 700, color: '#f4212e' }}>-{len - 280}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── LinkedIn ───────────────────────────────────────────── */
function LinkedInPreview({ caption, hashtags, imageUrl, username, dark }) {
  const [expanded, setExpanded] = useState(false);
  const fullText = [caption, hashtags].filter(Boolean).join('\n');
  const TRUNCATE = 200;
  const shouldTruncate = fullText.length > TRUNCATE && !expanded;
  const displayText = shouldTruncate ? fullText.slice(0, TRUNCATE) + '…' : fullText;
  const initial = (username || 'U').charAt(0).toUpperCase();

  const bg        = dark ? '#1b1f23' : '#ffffff';
  const border    = dark ? '#38434f' : '#e0e0e0';
  const textMain  = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)';
  const textMid   = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
  const textMuted = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)';
  const divider   = dark ? '#38434f' : '#e0e0e0';
  const actColor  = dark ? 'rgba(255,255,255,0.55)' : '#666666';
  const actStroke = dark ? 'rgba(255,255,255,0.55)' : '#666666';
  const avatarBorder = dark ? '#1b1f23' : '#ffffff';

  const no = { pointerEvents: 'none', userSelect: 'none' };
  const yes = { pointerEvents: 'auto', userSelect: 'none' };

  return (
    <div style={{ width: '100%', maxWidth: 400, background: bg, border: `1px solid ${border}`, borderRadius: 8, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", overflow: 'hidden', boxSizing: 'border-box', boxShadow: dark ? 'none' : '0 0 0 1px rgba(0,0,0,0.06),0 2px 4px rgba(0,0,0,0.04)', ...no }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px 6px', boxSizing: 'border-box' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#0a66c2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>{initial}</div>
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 4, background: '#0a66c2', border: `2px solid ${avatarBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="#fff"><path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-9 14H7v-7h3v7zm-1.5-8.3a1.7 1.7 0 110-3.4 1.7 1.7 0 010 3.4zM17 17h-3v-3.5c0-2-2.5-1.8-2.5 0V17h-3v-7h3v1.1C12.4 9 17 8.8 17 12.9V17z"/></svg>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3' }}>{username || 'Your Name'}</span>
            <span style={{ fontSize: 13, color: textMid }}>· 1st</span>
          </div>
          <span style={{ fontSize: 12, color: textMid, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Your headline · Specialist</span>
          <span style={{ fontSize: 11.5, color: textMuted }}>Just now · 🌐</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0a66c2', whiteSpace: 'nowrap' }}>+ Follow</span>
          <span style={{ fontSize: 18, color: textMid, letterSpacing: 1 }}>···</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '6px 16px 10px', boxSizing: 'border-box' }}>
        {fullText
          ? <p style={{ margin: 0, padding: 0, fontSize: 14, lineHeight: '1.55', color: textMain, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {displayText}
              {shouldTruncate && <button onClick={() => setExpanded(true)} style={{ background: 'none', border: 'none', fontSize: 14, color: textMuted, padding: 0, cursor: 'pointer', display: 'inline', ...yes }}>…see more</button>}
              {expanded && <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', fontSize: 14, color: textMuted, padding: 0, cursor: 'pointer', display: 'inline', marginLeft: 4, ...yes }}>see less</button>}
            </p>
          : <p style={{ margin: 0, fontSize: 14, color: textMuted, fontStyle: 'italic' }}>Post will appear here…</p>
        }
      </div>

      {/* Image */}
      {imageUrl && (
        <div style={{ width: '100%', overflow: 'hidden', background: dark ? '#111' : '#f3f2ef' }}>
          <img src={imageUrl} alt="" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }}/>
        </div>
      )}

      {/* Reactions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 4px', boxSizing: 'border-box' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span style={{ fontSize: 16 }}>👍</span><span style={{ fontSize: 16 }}>❤️</span><span style={{ fontSize: 16 }}>👏</span>
        </span>
        <span style={{ fontSize: 12, color: textMuted }}>Be the first to react</span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: divider, margin: '0 16px' }}/>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '2px 4px 4px', boxSizing: 'border-box' }}>
        {[
          { path: <><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></>, label: 'Like' },
          { path: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>, label: 'Comment' },
          { path: <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>, label: 'Repost' },
          { path: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>, label: 'Send' },
        ].map(({ path, label }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 6px' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={actStroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: actColor }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main export ────────────────────────────────────────── */
export function PostPreview({ platform, caption, hashtags, imageUrl, username }) {
  const { theme } = useSettings();
  const dark = theme === 'dark';

  if (platform === 'twitter') return <TwitterPreview caption={caption} hashtags={hashtags} username={username} dark={dark} />;
  if (platform === 'linkedin') return <LinkedInPreview caption={caption} hashtags={hashtags} imageUrl={imageUrl} username={username} dark={dark} />;
  return <InstagramPreview caption={caption} hashtags={hashtags} imageUrl={imageUrl} username={username} dark={dark} />;
}
