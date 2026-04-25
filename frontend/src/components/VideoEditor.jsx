import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiRotateCcw, FiRotateCw } from 'react-icons/fi';
import { useTranslation } from '../i18n';
import '../styles/ImageEditor.css';
import '../styles/VideoEditor.css';

const ASPECTS = [
  { label: '9:16', value: 9 / 16 },
  { label: '4:5', value: 4 / 5 },
  { label: '1:1', value: 1 },
  { label: 'Landscape', value: 1.91 },
  { label: 'Original', value: 'free' },
];

const SPEEDS = [0.5, 0.75, 1, 1.5, 2];

export default function VideoEditor({ src, onApply, onCancel }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [ffmpegError, setFfmpegError] = useState('');
  const ffmpegRef = useRef(null);

  const isFree = ASPECTS[aspectIdx].value === 'free';

  const loadFfmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    setFfmpegLoading(true);
    setFfmpegError('');
    try {
      await new Promise((resolve, reject) => {
        if (window.FFmpeg) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      const { createFFmpeg, fetchFile } = window.FFmpeg;
      const ff = createFFmpeg({
        log: false,
        progress: ({ ratio }) => setProgress(Math.round(ratio * 100)),
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      });
      await ff.load();
      ffmpegRef.current = { ff, fetchFile };
      setFfmpegReady(true);
      return ffmpegRef.current;
    } catch (e) {
      setFfmpegError('Failed to load video processor. Check your connection and try again.');
      return null;
    } finally {
      setFfmpegLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFfmpeg();
  }, [loadFfmpeg]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.src = src;
    v.playbackRate = speed;
    const onLoaded = () => {
      setDuration(v.duration);
      setTrimEnd(v.duration);
    };
    v.addEventListener('loadedmetadata', onLoaded);
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, [src, speed]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const handleReset = () => {
    setTrimStart(0);
    setTrimEnd(duration);
    setSpeed(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setAspectIdx(0);
  };

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return `${m}:${sec.padStart(4, '0')}`;
  };

  const handleApply = async () => {
    setApplying(true);
    setProgress(0);
    try {
      const loaded = await loadFfmpeg();
      if (!loaded) { setApplying(false); return; }
      const { ff, fetchFile } = loaded;

      ff.FS('writeFile', 'input.mp4', await fetchFile(src));

      const filters = [];
      const aspect = ASPECTS[aspectIdx];

      if (rotation !== 0 || flipH || flipV) {
        let vf = '';
        if (rotation === 90) vf = 'transpose=1';
        else if (rotation === 180) vf = 'transpose=1,transpose=1';
        else if (rotation === 270) vf = 'transpose=2';
        if (flipH) vf = vf ? `${vf},hflip` : 'hflip';
        if (flipV) vf = vf ? `${vf},vflip` : 'vflip';
        if (vf) filters.push(vf);
      }

      if (aspect.value !== 'free') {
        const ratio = aspect.value;
        filters.push(`crop=if(gt(a\\,${ratio})\\,oh*${ratio}\\,iw):if(gt(a\\,${ratio})\\,ih\\,ow/${ratio})`);
      }

      const vfStr = filters.length > 0 ? ['-vf', filters.join(',')] : [];
      const trimArgs = trimStart > 0 || trimEnd < duration
        ? ['-ss', String(trimStart.toFixed(3)), '-to', String(trimEnd.toFixed(3))]
        : [];
      const speedFilter = speed !== 1
        ? ['-filter_complex', `[0:v]setpts=${(1 / speed).toFixed(4)}*PTS[v];[0:a]atempo=${speed}[a]`, '-map', '[v]', '-map', '[a]']
        : [];

      let args;
      if (speedFilter.length > 0) {
        args = ['-i', 'input.mp4', ...trimArgs, ...speedFilter, '-c:v', 'libx264', '-preset', 'fast', 'output.mp4'];
      } else {
        args = ['-i', 'input.mp4', ...trimArgs, ...vfStr, '-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac', 'output.mp4'];
      }

      await ff.run(...args);
      const data = ff.FS('readFile', 'output.mp4');
      ff.FS('unlink', 'input.mp4');
      ff.FS('unlink', 'output.mp4');

      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const file = new File([blob], 'edited-video.mp4', { type: 'video/mp4' });
      onApply(file);
    } catch (e) {
      console.error('Video edit failed', e);
      setFfmpegError('Processing failed. Try with a shorter clip.');
    } finally {
      setApplying(false);
      setProgress(0);
    }
  };

  const videoStyle = {
    transform: `
      rotate(${rotation}deg)
      scaleX(${flipH ? -1 : 1})
      scaleY(${flipV ? -1 : 1})
    `,
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  };

  return (
    <div className="ie-overlay">
      <div className="ie-modal ve-modal">
        <div className="ie-header">
          <span className="ie-title">Edit Video</span>
          <button className="ie-close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="ie-crop-area ve-preview-area">
          <video
            ref={videoRef}
            style={videoStyle}
            controls
            playsInline
          />
          {!isFree && ASPECTS[aspectIdx].value && (
            <div
              className="ve-aspect-overlay"
              style={{ aspectRatio: String(ASPECTS[aspectIdx].value) }}
            />
          )}
        </div>

        <div className="ie-controls">

          {ffmpegLoading && (
            <div className="ve-ffmpeg-loading">
              <span className="ve-ffmpeg-spinner" /> Loading video processor…
            </div>
          )}
          {ffmpegError && <div className="ve-error">{ffmpegError}</div>}

          <div className="ie-aspect-row">
            {ASPECTS.map((a, i) => (
              <button
                key={a.label}
                className={`ie-aspect-btn${aspectIdx === i ? ' ie-aspect-btn--active' : ''}`}
                onClick={() => setAspectIdx(i)}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="ie-transform-row">
            <button className="ie-icon-btn" onClick={() => setRotation(r => (r - 90 + 360) % 360)} title="Rotate left">
              <FiRotateCcw />
            </button>
            <button className="ie-icon-btn" onClick={() => setRotation(r => (r + 90) % 360)} title="Rotate right">
              <FiRotateCw />
            </button>
            <button className={`ie-icon-btn ie-text-btn${flipH ? ' ie-icon-btn--active' : ''}`} onClick={() => setFlipH(f => !f)}>
              {t('create.editFlipH')}
            </button>
            <button className={`ie-icon-btn ie-text-btn${flipV ? ' ie-icon-btn--active' : ''}`} onClick={() => setFlipV(f => !f)}>
              {t('create.editFlipV')}
            </button>
            <button className="ie-icon-btn ie-text-btn ie-reset-btn" onClick={handleReset}>
              {t('create.editReset')}
            </button>
          </div>

          {duration > 0 && (
            <>
              <div className="ie-slider-row">
                <label>
                  Trim Start <span>{fmtTime(trimStart)}</span>
                </label>
                <input
                  type="range" min={0} max={duration} step={0.1}
                  value={trimStart}
                  onChange={e => {
                    const v = Math.min(Number(e.target.value), trimEnd - 0.5);
                    setTrimStart(v);
                    if (videoRef.current) videoRef.current.currentTime = v;
                  }}
                />
              </div>
              <div className="ie-slider-row">
                <label>
                  Trim End <span>{fmtTime(trimEnd)}</span>
                </label>
                <input
                  type="range" min={0} max={duration} step={0.1}
                  value={trimEnd}
                  onChange={e => {
                    const v = Math.max(Number(e.target.value), trimStart + 0.5);
                    setTrimEnd(v);
                    if (videoRef.current) videoRef.current.currentTime = v;
                  }}
                />
              </div>
              <div className="ve-trim-info">
                Duration after trim: <strong>{fmtTime(trimEnd - trimStart)}</strong>
              </div>
            </>
          )}

          <div className="ve-speed-row">
            <span className="ve-speed-label">Speed</span>
            <div className="ve-speed-btns">
              {SPEEDS.map(s => (
                <button
                  key={s}
                  className={`ve-speed-btn${speed === s ? ' active' : ''}`}
                  onClick={() => setSpeed(s)}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {applying && (
            <div className="ve-progress-wrap">
              <div className="ve-progress-bar" style={{ width: `${progress}%` }} />
              <span className="ve-progress-label">{progress}% — Processing…</span>
            </div>
          )}

          <div className="ie-action-row">
            <button className="ie-btn-cancel" onClick={onCancel} disabled={applying}>
              {t('create.editCancel')}
            </button>
            <button
              className="ie-btn-apply"
              onClick={handleApply}
              disabled={applying || !ffmpegReady}
              title={!ffmpegReady ? 'Video processor loading…' : ''}
            >
              {applying ? `Processing ${progress}%…` : ffmpegLoading ? 'Loading…' : t('create.editApply')}
            </button>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
