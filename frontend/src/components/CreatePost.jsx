import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { aiAPI, postsAPI, clientsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useActiveClient } from '../context/ActiveClientContext';
import { FiRefreshCw, FiCheck, FiCopy, FiCamera, FiX, FiUpload, FiRefreshCcw, FiVideo } from 'react-icons/fi';
import ImageEditor from './ImageEditor';
import VideoEditor from './VideoEditor';
import { PostPreview, CaptionCounter, HashtagsCounter, LIMITS } from './PostPreview';
import '../styles/CreatePost.css';

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const role = localStorage.getItem('role');
const isOwner = role === 'owner';
const isSpecialist = role === 'specialist';

function UnsavedModal({ onLeave, onStay, t }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onStay(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onStay]);
  return (
    <div className="edit-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onStay(); }}>
      <div className="edit-modal">
        <div className="edit-modal-header">
          <span className="edit-modal-icon">⚠️</span>
          <h3>{t('edit.unsavedTitle')}</h3>
        </div>
        <p className="edit-modal-msg">{t('edit.unsavedMsg')}</p>
        <div className="edit-modal-actions">
          <button className="edit-modal-leave-btn" onClick={onLeave}>{t('edit.leave')}</button>
          <button className="edit-modal-stay-btn" onClick={onStay}>{t('edit.stay')}</button>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button className={`btn-copy${copied ? ' btn-copy--done' : ''}`} onClick={handleCopy} title={t('generate.copy')} disabled={!text}>
      {copied ? <FiCheck /> : <FiCopy />}
      {copied ? t('generate.copied') : t('generate.copy')}
    </button>
  );
}

function RegenButton({ onClick, loading, disabled, t }) {
  return (
    <button
      className={`btn-regen${loading ? ' btn-regen--loading' : ''}`}
      onClick={onClick}
      disabled={loading || disabled}
      title={disabled ? t('create.topicRequiredRegen') : t('generate.regen')}
    >
      <FiRefreshCw style={loading ? { animation: 'spin 0.7s linear infinite' } : {}} />
      {loading ? t('generate.regenLoading') : t('generate.regen')}
    </button>
  );
}

function CreatePost() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [topic, setTopic] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [platform, setPlatform] = useState('instagram');

  const [tone, setTone] = useState('professional');
  const [scheduledTime, setScheduledTime] = useState('');
  const { activeClientId } = useActiveClient();
  const [clientId, setClientId] = useState(() => activeClientId ? String(activeClientId) : '');
  const [clients, setClients] = useState([]);
  useEffect(() => {
    if (isSpecialist) {
      clientsAPI.list().then(res => setClients(res.data)).catch(() => {});
    }
  }, []);

  // When the active client context changes (e.g. specialist switches client while on this page),
  // keep the selector in sync — but only if the user hasn't manually overridden it yet.
  useEffect(() => {
    setClientId(activeClientId ? String(activeClientId) : '');
  }, [activeClientId]);
  const [polishing, setPolishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [regenLoading, setRegenLoading] = useState({ caption: false, hashtags: false, image_prompt: false });
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [uploadedImagePreview, setUploadedImagePreview] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState('');
  const [uploadedVideoPreview, setUploadedVideoPreview] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedSrc, setCapturedSrc] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraMode, setCameraMode] = useState('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSrc, setRecordedSrc] = useState(null);
  const [editorSrc, setEditorSrc] = useState(null);
  const [videoEditorSrc, setVideoEditorSrc] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const canvasStreamRef = useRef(null);
  const rafRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageMenuRef = useRef(null);

  useEffect(() => {
    if (!showImageMenu) return;
    const handler = (e) => {
      if (imageMenuRef.current && !imageMenuRef.current.contains(e.target)) {
        setShowImageMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showImageMenu]);

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploadError('');
    setUploading(true);
    setUploadedImagePreview(URL.createObjectURL(file));
    try {
      const res = await postsAPI.uploadImage(file);
      setUploadedImageUrl(res.data.image_url);
    } catch (err) {
      const msg = err.response?.data?.error || t('create.uploadFailed');
      setUploadError(msg);
      setUploadedImagePreview('');
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (file) => {
    if (!file) return;
    setUploadError('');
    setUploading(true);
    setUploadProgress(0);
    setUploadedVideoPreview(URL.createObjectURL(file));
    setMediaType('video');
    try {
      const res = await postsAPI.uploadVideo(file, setUploadProgress);
      setUploadedVideoUrl(res.data.video_url);
    } catch (err) {
      const msg = err.response?.data?.error || 'Video upload failed';
      setUploadError(msg);
      setUploadedVideoPreview('');
      setMediaType('image');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith('video/')) {
      setVideoEditorSrc(URL.createObjectURL(file));
    } else {
      handleImageUpload(file);
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startStream = async (facing) => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraError(t('create.cameraAccessDenied'));
      } else {
        setCameraError(t('create.cameraUnavailable'));
      }
    }
  };

  const openCamera = async () => {
    setShowImageMenu(false);
    setCameraError('');
    setFacingMode('environment');
    setShowCamera(true);
    await startStream('environment');
  };

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (isRecording) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next } });
        const oldStream = streamRef.current;
        streamRef.current = newStream;
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          await new Promise(res => {
            videoRef.current.onloadedmetadata = res;
          });
          await videoRef.current.play();
        }
        oldStream?.getTracks().forEach(t => t.stop());
      } catch {}
    } else {
      await startStream(next);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      stopStream();
      setCapturedSrc(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.92);
  };

  const retakePhoto = async () => {
    setCapturedSrc(null);
    await startStream(facingMode);
  };

  const usePhoto = () => {
    const src = capturedSrc;
    setCapturedSrc(null);
    setShowCamera(false);
    setEditorSrc(src);
  };

  const startRecording = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d');

    const drawFrame = () => {
      if (!videoRef.current) return;
      canvas.width = videoRef.current.videoWidth || canvas.width;
      canvas.height = videoRef.current.videoHeight || canvas.height;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      rafRef.current = requestAnimationFrame(drawFrame);
    };
    rafRef.current = requestAnimationFrame(drawFrame);

    const canvasStream = canvas.captureStream(30);
    canvasStreamRef.current = canvasStream;

    recordedChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(canvasStream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      cancelAnimationFrame(rafRef.current);
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      stopStream();
      setRecordedSrc(URL.createObjectURL(blob));
      setIsRecording(false);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const retakeVideo = async () => {
    setRecordedSrc(null);
    await startStream(facingMode);
  };

  const useVideo = () => {
    const src = recordedSrc;
    setRecordedSrc(null);
    setShowCamera(false);
    fetch(src)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], 'recorded.webm', { type: blob.type });
        openVideoFromFile(file);
      });
  };

  const openEditorFromFile = (file) => {
    if (!file) return;
    setShowImageMenu(false);
    setEditorSrc(URL.createObjectURL(file));
  };

  const handleEditorApply = (file) => {
    setEditorSrc(null);
    handleImageUpload(file);
  };

  const handleEditorCancel = () => {
    setEditorSrc(null);
  };

  const handleVideoEditorApply = (file) => {
    setVideoEditorSrc(null);
    handleVideoUpload(file);
  };

  const handleVideoEditorCancel = () => {
    setVideoEditorSrc(null);
  };

  const openVideoFromFile = (file) => {
    if (!file) return;
    setShowImageMenu(false);
    setVideoEditorSrc(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setUploadedImagePreview('');
    setUploadedImageUrl('');
    setUploadedVideoPreview('');
    setUploadedVideoUrl('');
    setUploadError('');
    setMediaType('image');
  };

  const closeCamera = () => {
    cancelAnimationFrame(rafRef.current);
    mediaRecorderRef.current?.stop();
    stopStream();
    setShowCamera(false);
    setCameraError('');
    setCapturedSrc(null);
    setRecordedSrc(null);
    setIsRecording(false);
    setCameraMode('photo');
  };

  const isDirty = !!(caption || hashtags || imagePrompt || topic || uploadedImageUrl || uploadedVideoUrl);

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    const handler = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handlePolish = async () => {
    if (!caption.trim()) {
      setError(t('create.captionRequiredPolish'));
      return;
    }
    setPolishing(true);
    setError('');
    try {
      const res = await aiAPI.polishContent({ topic, caption, hashtags, image_prompt: imagePrompt, platform, tone, client_id: clientId || undefined });
      setCaption(res.data.caption);
      setHashtags(res.data.hashtags);
      if (res.data.image_prompt) setImagePrompt(res.data.image_prompt);
    } catch {
      setError(t('create.failedPolish'));
    } finally {
      setPolishing(false);
    }
  };

  // Regen uses polishContent so it's aware of all existing content, not just topic.
  // If caption is empty (nothing to be context-aware of), falls back to generateContent.
  const handleRegen = async (field) => {
    if (!topic.trim() && !caption.trim()) {
      setError(t('create.topicRequiredRegen'));
      return;
    }
    setRegenLoading(prev => ({ ...prev, [field]: true }));
    setError('');
    try {
      let res;
      if (caption.trim()) {
        res = await aiAPI.polishContent({ topic, caption, hashtags, image_prompt: imagePrompt, platform, tone, client_id: clientId || undefined });
      } else {
        res = await aiAPI.generateContent({ topic, platform, tone, client_id: clientId || undefined });
      }
      if (field === 'caption') setCaption(res.data.caption);
      else if (field === 'hashtags') setHashtags(res.data.hashtags);
      else if (field === 'image_prompt' && res.data.image_prompt) setImagePrompt(res.data.image_prompt);
    } catch {
      setError(t('generate.failedRegen'));
    } finally {
      setRegenLoading(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleSave = async () => {
    if (!caption.trim()) {
      setError(t('create.captionRequired'));
      return;
    }
    if (platform === 'instagram' && !uploadedImageUrl && !uploadedVideoUrl) {
      setError(t('create.imageRequired'));
      return;
    }
    const resolvedClient = activeClientId ?? (clientId ? parseInt(clientId, 10) : null);
    if (clients.length > 0 && !resolvedClient) {
      setError(t('create.clientRequired'));
      return;
    }
    setSaving(true);
    setError('');
    // Use activeClientId from context as authoritative source when a filter is active;
    // fall back to the manual dropdown selection.
    const resolvedClientId = activeClientId ?? (clientId ? parseInt(clientId, 10) : null);
    const hasSchedule = isOwner && scheduledTime;
    try {
      await postsAPI.create({
        topic, caption, hashtags, tone,
        image_prompt: imagePrompt,
        image_url: mediaType === 'image' ? (uploadedImageUrl || undefined) : undefined,
        video_url: mediaType === 'video' ? (uploadedVideoUrl || undefined) : undefined,
        media_type: mediaType,
        platform,
        status: hasSchedule ? 'scheduled' : 'draft',
        scheduled_time: hasSchedule ? scheduledTime : null,
        client: resolvedClientId || null,
      });
      setSuccessMsg(t('create.savedMsg'));
      setCaption(''); setHashtags(''); setImagePrompt(''); setTopic('');
      clearMedia();
      setTimeout(() => navigate('/posts'), 1500);
    } catch {
      setError(t('create.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="create-container">
      {blocker.state === 'blocked' && (
        <UnsavedModal t={t} onLeave={() => blocker.proceed()} onStay={() => blocker.reset()} />
      )}
      <div className="create-header">
        <h1>{t('create.title')}</h1>
        <p className="create-subtitle">{t('create.subtitle')}</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMsg && <div className="success-message">{successMsg}</div>}

      <div className="create-layout">
      <div className="create-layout-form">
      <div className="create-card">
        <div className="create-form-group">
          <label>{t('create.topic')}</label>
          <input
            type="text"
            placeholder={t('create.topicPlaceholder')}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div className="create-form-row">
          <div className="create-form-group">
            <label>{t('create.platform')}</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter</option>
            </select>
          </div>
          <div className="create-form-group">
            <label>{t('create.tone')}</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="professional">{t('create.professional')}</option>
              <option value="casual">{t('create.casual')}</option>
              <option value="funny">{t('create.funny')}</option>
              <option value="inspirational">{t('create.inspirational')}</option>
            </select>
          </div>
        </div>

        {clients.length > 0 && (
          <div className="create-form-group">
            <label>
              Assign to Client{' '}
              {activeClientId
                ? <span className="label-context-set">pre-filled from filter</span>
                : <span className="label-required">*</span>
              }
            </label>
            {activeClientId ? (
              <div className="create-client-locked">
                {(() => {
                  const c = clients.find(x => String(x.id) === clientId);
                  return c
                    ? `${[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username}`
                    : clientId;
                })()}
              </div>
            ) : (
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— Select a client —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {clientId && (() => {
          const c = clients.find(x => String(x.id) === clientId);
          return c ? (
            <div className="brand-banner brand-banner--ok">
              <span>✓ Using brand context for <strong>{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username}</strong></span>
            </div>
          ) : null;
        })()}

        <div className="create-form-group">
          <div className="create-field-label-row">
            <label>{t('create.caption')} <span className="label-required">*</span></label>
            <div className="create-field-actions">
              <CaptionCounter caption={caption} hashtags={hashtags} platform={platform} />
              <RegenButton onClick={() => handleRegen('caption')} loading={regenLoading.caption} disabled={!topic.trim() && !caption.trim()} t={t} />
              <CopyButton text={caption} />
            </div>
          </div>
          <textarea
            rows={6}
            placeholder={t('create.captionPlaceholder')}
            value={caption}
            onChange={(e) => {
              const limit = LIMITS[platform]?.caption;
              if (platform === 'twitter') {
                const combined = [e.target.value, hashtags].filter(Boolean).join(' ');
                if (limit && combined.length > limit) return;
              } else if (limit && e.target.value.length > limit) {
                return;
              }
              setCaption(e.target.value);
            }}
            disabled={regenLoading.caption}
          />
        </div>

        <div className="create-form-group">
          <div className="create-field-label-row">
            <label>{t('create.hashtags')}</label>
            <div className="create-field-actions">
              <HashtagsCounter hashtags={hashtags} platform={platform} />
              <RegenButton onClick={() => handleRegen('hashtags')} loading={regenLoading.hashtags} disabled={!topic.trim() && !caption.trim()} t={t} />
              <CopyButton text={hashtags} />
            </div>
          </div>
          <input
            type="text"
            placeholder={t('create.hashtagsPlaceholder')}
            value={hashtags}
            onChange={(e) => {
              if (platform === 'twitter') {
                const combined = [caption, e.target.value].filter(Boolean).join(' ');
                if (combined.length > LIMITS.twitter.caption) return;
              } else if (platform === 'instagram') {
                const tags = e.target.value.trim().split(/\s+/).filter(t => t.startsWith('#')).length;
                if (tags > LIMITS.instagram.hashtagCount) return;
              }
              setHashtags(e.target.value);
            }}
            disabled={regenLoading.hashtags}
          />
        </div>

        <div className="create-form-group">
          <div className="create-field-label-row">
            <label>{t('create.imagePrompt')} <span className="label-optional">{t('create.optional')}</span></label>
            <div className="create-field-actions">
              <RegenButton onClick={() => handleRegen('image_prompt')} loading={regenLoading.image_prompt} disabled={!topic.trim() && !caption.trim()} t={t} />
              <CopyButton text={imagePrompt} />
            </div>
          </div>
          <textarea
            rows={3}
            placeholder={t('create.imagePromptPlaceholder')}
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            disabled={regenLoading.image_prompt}
          />
        </div>

        <div className="create-form-group">
          <label>
            Media{' '}
            {platform === 'instagram'
              ? <span className="label-required">*</span>
              : <span className="label-optional">{t('create.optional')}</span>}
          </label>
          {uploadError && <p className="create-upload-error">{uploadError}</p>}
          {(uploadedImagePreview || uploadedVideoPreview) ? (
            <div className="create-upload-preview">
              <div className="create-upload-img-wrap">
                {mediaType === 'video'
                  ? <video src={uploadedVideoPreview} className="create-upload-img" controls playsInline />
                  : <img src={uploadedImagePreview} alt="preview" className="create-upload-img" />}
                <button
                  className="create-upload-remove"
                  onClick={clearMedia}
                  title="Remove"
                >
                  <FiX />
                </button>
                {uploading && (
                  <div className="create-upload-overlay">
                    {uploadProgress > 0 ? `${uploadProgress}%` : t('create.uploading')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div ref={imageMenuRef} className="create-upload-zone-wrap" onDrop={handleImageDrop} onDragOver={(e) => e.preventDefault()}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/x-m4v"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.type.startsWith('video/')) openVideoFromFile(file);
                  else openEditorFromFile(file);
                }}
              />
              <button
                className="create-upload-cam-btn"
                onClick={() => setShowImageMenu(m => !m)}
                type="button"
              >
                <FiCamera />
              </button>

              {showImageMenu && (
                <div className="create-upload-menu">
                  <button onClick={() => { setShowImageMenu(false); fileInputRef.current?.click(); }}>
                    <FiUpload /> Upload a file
                  </button>
                  <button onClick={openCamera}>
                    <FiCamera /> Open camera
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {showCamera && (
          <div className="create-camera-overlay">
            <div className="create-camera-modal">
              <button className="create-camera-close" onClick={closeCamera}><FiX /></button>
              {isMobile && !capturedSrc && !recordedSrc && (
                <div className="create-camera-mode-tabs">
                  <button className={cameraMode === 'photo' ? 'active' : ''} onClick={() => setCameraMode('photo')}><FiCamera /> Photo</button>
                  <button className={cameraMode === 'video' ? 'active' : ''} onClick={() => setCameraMode('video')}><FiVideo /> Video</button>
                </div>
              )}
              {cameraError ? (
                <p className="create-camera-error">{cameraError}</p>
              ) : capturedSrc ? (
                <>
                  <img src={capturedSrc} alt="captured" className="create-camera-video" />
                  <div className="create-camera-retake-row">
                    <button className="create-camera-retake-btn" onClick={retakePhoto}>
                      <FiRefreshCcw /> {t('create.retake')}
                    </button>
                    <button className="create-camera-use-btn" onClick={usePhoto}>
                      {t('create.usePhoto')}
                    </button>
                  </div>
                </>
              ) : recordedSrc ? (
                <>
                  <video src={recordedSrc} controls className="create-camera-video" />
                  <div className="create-camera-retake-row">
                    <button className="create-camera-retake-btn" onClick={retakeVideo}>
                      <FiRefreshCcw /> {t('create.retake')}
                    </button>
                    <button className="create-camera-use-btn" onClick={useVideo}>
                      Use video
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="create-camera-video" />
                  {isMobile && (
                    <button className="create-camera-flip" onClick={flipCamera} title="Flip camera">
                      <FiRefreshCcw />
                    </button>
                  )}
                  {cameraMode === 'photo' ? (
                    <button className="create-camera-capture" onClick={capturePhoto}>
                      <span className="create-camera-shutter" />
                    </button>
                  ) : (
                    <button
                      className={`create-camera-capture${isRecording ? ' create-camera-capture--recording' : ''}`}
                      onClick={isRecording ? stopRecording : startRecording}
                    >
                      <span className={isRecording ? 'create-camera-stop' : 'create-camera-shutter'} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {isOwner && (
          <div className="create-form-group">
            <label>{t('create.scheduleTime')} <span className="label-optional">{t('create.optional')}</span></label>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            {scheduledTime && (
              <p className="create-schedule-hint">{t('create.scheduleHint')}</p>
            )}
          </div>
        )}

        <button className="btn-ai-assist" onClick={handlePolish} disabled={polishing}>
          {polishing ? (
            <><span className="btn-spinner" /> {t('common.polishing')}</>
          ) : (
            <>{t('common.polishWithAI')}</>
          )}
        </button>

        <button className="btn-save-draft" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : (isOwner && scheduledTime ? t('create.schedulePost') : t('generate.saveAsDraft'))}
        </button>
      </div>
      </div>

      <div className="create-layout-preview">
        <div className="preview-label">{t('create.previewTitle')}</div>
        <PostPreview
          platform={platform}
          caption={caption}
          hashtags={hashtags}
          imageUrl={uploadedImagePreview || undefined}
          username={localStorage.getItem('username') || ''}
        />
      </div>
      </div>

      {editorSrc && (
        <ImageEditor
          src={editorSrc}
          onApply={handleEditorApply}
          onCancel={handleEditorCancel}
        />
      )}
      {videoEditorSrc && (
        <VideoEditor
          src={videoEditorSrc}
          onApply={handleVideoEditorApply}
          onCancel={handleVideoEditorCancel}
        />
      )}
    </div>
  );
}

export default CreatePost;
