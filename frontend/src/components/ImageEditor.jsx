import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { FiRotateCcw, FiRotateCw } from 'react-icons/fi';
import { useTranslation } from '../i18n';
import '../styles/ImageEditor.css';

function applyTransformToDataUrl(src, rotation, flipH, flipV) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const rad = (rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));
      const w = img.width * cos + img.height * sin;
      const h = img.width * sin + img.height * cos;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
  });
}

function getCroppedBlob(imageSrc, cropPx, brightness, contrast, saturation) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cropPx.width;
      canvas.height = cropPx.height;
      const ctx = canvas.getContext('2d');
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.drawImage(img, cropPx.x, cropPx.y, cropPx.width, cropPx.height, 0, 0, cropPx.width, cropPx.height);
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    };
  });
}

function getFullBlob(imageSrc, brightness, contrast, saturation) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    };
  });
}

const ASPECTS = [
  { label: '4:5', value: 4 / 5 },
  { label: '1:1', value: 1 },
  { label: 'Landscape', value: 1.91 },
  { label: 'Original', value: 'original' },
];

const DEFAULTS = { brightness: 100, contrast: 100, saturation: 100 };

export default function ImageEditor({ src, onApply, onCancel }) {
  const { t } = useTranslation();

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(DEFAULTS.brightness);
  const [contrast, setContrast] = useState(DEFAULTS.contrast);
  const [saturation, setSaturation] = useState(DEFAULTS.saturation);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [applying, setApplying] = useState(false);
  const [transformedSrc, setTransformedSrc] = useState(src);

  const isOriginal = ASPECTS[aspectIdx].value === 'original';

  useEffect(() => {
    let cancelled = false;
    applyTransformToDataUrl(src, rotation, flipH, flipV).then((url) => {
      if (!cancelled) {
        setTransformedSrc(url);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      }
    });
    return () => { cancelled = true; };
  }, [src, rotation, flipH, flipV]);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setBrightness(DEFAULTS.brightness);
    setContrast(DEFAULTS.contrast);
    setSaturation(DEFAULTS.saturation);
    setAspectIdx(0);
  };

  const handleApply = async () => {
    setApplying(true);
    if (isOriginal) {
      const blob = await getFullBlob(transformedSrc, brightness, contrast, saturation);
      const file = new File([blob], 'edited-image.jpg', { type: 'image/jpeg' });
      onApply(file);
    } else {
      if (!croppedAreaPixels) { setApplying(false); return; }
      const blob = await getCroppedBlob(transformedSrc, croppedAreaPixels, brightness, contrast, saturation);
      const file = new File([blob], 'edited-image.jpg', { type: 'image/jpeg' });
      onApply(file);
    }
  };

  const previewFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  return (
    <div className="ie-overlay">
      <div className="ie-modal">
        <div className="ie-header">
          <span className="ie-title">{t('create.editPhoto')}</span>
          <button className="ie-close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="ie-crop-area">
          {isOriginal ? (
            <div className="ie-free-crop-wrap">
              <img
                src={transformedSrc}
                alt="edit"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: previewFilter }}
              />
            </div>
          ) : (
            <Cropper
              image={transformedSrc}
              crop={crop}
              zoom={zoom}
              aspect={ASPECTS[aspectIdx].value}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{ mediaStyle: { filter: previewFilter } }}
            />
          )}
        </div>

        <div className="ie-controls">
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
            <button className="ie-icon-btn" onClick={() => setRotation(r => r - 90)} title={t('create.editRotateLeft')}>
              <FiRotateCcw />
            </button>
            <button className="ie-icon-btn" onClick={() => setRotation(r => r + 90)} title={t('create.editRotateRight')}>
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

          <div className="ie-slider-row">
            <label>{t('create.editBrightness')} <span>{brightness}%</span></label>
            <input type="range" min={0} max={200} value={brightness} onChange={e => setBrightness(Number(e.target.value))} />
          </div>
          <div className="ie-slider-row">
            <label>{t('create.editContrast')} <span>{contrast}%</span></label>
            <input type="range" min={0} max={200} value={contrast} onChange={e => setContrast(Number(e.target.value))} />
          </div>
          <div className="ie-slider-row">
            <label>{t('create.editSaturation')} <span>{saturation}%</span></label>
            <input type="range" min={0} max={200} value={saturation} onChange={e => setSaturation(Number(e.target.value))} />
          </div>

          <div className="ie-action-row">
            <button className="ie-btn-cancel" onClick={onCancel} disabled={applying}>
              {t('create.editCancel')}
            </button>
            <button className="ie-btn-apply" onClick={handleApply} disabled={applying}>
              {applying ? '…' : t('create.editApply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
