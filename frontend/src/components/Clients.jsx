import React, { useState, useEffect } from 'react';
import { invitationsAPI, emailConfigAPI, profileAPI, clientsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useActiveClient } from '../context/ActiveClientContext';
import '../styles/Clients.css';

function StatusBadge({ status, t }) {
  const labels = {
    pending: t('clients.statusPending'),
    accepted: t('clients.statusAccepted'),
    revoked: t('clients.statusRevoked'),
    expired: t('clients.statusExpired'),
  };
  return <span className={`inv-badge inv-badge--${status}`}>{labels[status] || status}</span>;
}

function Clients() {
  const { t } = useTranslation();
  const { refreshClients } = useActiveClient();
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [invitations, setInvitations] = useState([]);
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState('');

  const [emailInput, setEmailInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [sendError, setSendError] = useState('');

  const [revoking, setRevoking] = useState(null);
  const [removing, setRemoving] = useState(null);

  const [emailCfg, setEmailCfg] = useState(null);
  const [cfgLoading, setCfgLoading] = useState(true);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [appPassword, setAppPassword] = useState('');
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgMsg, setCfgMsg] = useState('');
  const [cfgError, setCfgError] = useState('');
  const [cfgRemoving, setCfgRemoving] = useState(false);

  const [specialistEmail, setSpecialistEmail] = useState('');

  const loadClients = async () => {
    try {
      const res = await clientsAPI.list();
      setClients(res.data);
    } catch {
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const res = await invitationsAPI.list();
      setInvitations(res.data);
    } catch {
      setInvError(t('clients.failedLoadInvitations'));
    } finally {
      setInvLoading(false);
    }
  };

  const loadEmailCfg = async () => {
    try {
      const res = await emailConfigAPI.get();
      setEmailCfg(res.data.configured ? res.data : null);
    } catch {
      setEmailCfg(null);
    } finally {
      setCfgLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
    loadInvitations();
    loadEmailCfg();
    profileAPI.get().then(res => setSpecialistEmail(res.data.email || '')).catch(() => {});
  }, []);

  const handleSaveEmailCfg = async () => {
    if (!emailCfg && !appPassword.trim()) {
      setCfgError(t('clients.emailSaveError'));
      return;
    }
    setCfgSaving(true);
    setCfgMsg('');
    setCfgError('');
    try {
      const payload = appPassword.trim() ? { app_password: appPassword.trim() } : {};
      const res = await emailConfigAPI.save(payload);
      setEmailCfg(res.data);
      if (res.data.warning) {
        setCfgMsg(res.data.warning);
      } else {
        setCfgMsg(t('clients.emailSaved'));
      }
      setAppPassword('');
      setCfgOpen(false);
    } catch (err) {
      setCfgError(err.message || t('clients.emailSaveError'));
    } finally {
      setCfgSaving(false);
    }
  };

  const handleRemoveEmailCfg = async () => {
    if (!window.confirm(t('clients.revoke') + '?')) return;
    setCfgRemoving(true);
    setCfgMsg('');
    setCfgError('');
    try {
      await emailConfigAPI.remove();
      setEmailCfg(null);
    } catch (err) {
      setCfgError(err.message || t('clients.emailRemoveError'));
    } finally {
      setCfgRemoving(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setSendError(t('clients.invalidEmail'));
      return;
    }
    setSending(true);
    setSendMsg('');
    setSendError('');
    try {
      await invitationsAPI.send(emailInput.trim().toLowerCase());
      const sent = emailInput.trim();
      setEmailInput('');
      setSendMsg(`${t('clients.sendInvitation')}: ${sent}`);
      setTimeout(() => setSendMsg(''), 5000);
      loadInvitations();
    } catch (err) {
      setSendError(err.message || t('clients.failedSendInvitation'));
    } finally {
      setSending(false);
    }
  };

  const handleRemoveClient = async (id, username) => {
    if (!window.confirm(`${t('clients.remove')} @${username}?`)) return;
    setRemoving(id);
    try {
      await clientsAPI.remove(id);
      setClients(prev => prev.filter(c => c.id !== id));
      refreshClients();
    } catch (err) {
      setInvError(err.message || t('clients.removeClientError'));
    } finally {
      setRemoving(null);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm(t('clients.revoke') + '?')) return;
    setRevoking(id);
    try {
      await invitationsAPI.revoke(id);
      setInvitations(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'revoked' } : inv));
    } catch (err) {
      setInvError(err.message || t('clients.revoking'));
    } finally {
      setRevoking(null);
    }
  };

  const fmt = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const pendingCount = invitations.filter(i => i.status === 'pending').length;

  return (
    <div className="clients-container">
      <div className="clients-header">
        <h1>{t('clients.title')}</h1>
        <p className="clients-subtitle">{t('clients.subtitle')}</p>
      </div>

      {/* Connected Clients */}
      <div className="clients-card">
        <div className="clients-card-title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {t('clients.connectedTitle')}
          {clients.length > 0 && (
            <span className="inv-chip-accepted">{clients.length}</span>
          )}
        </div>

        {clientsLoading ? (
          <p className="clients-muted">{t('clients.loading')}</p>
        ) : clients.length === 0 ? (
          <div className="inv-empty">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            <p>{t('clients.noClients')}</p>
          </div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>{t('clients.colName')}</th>
                  <th>{t('clients.colUsername')}</th>
                  <th>{t('clients.colEmail')}</th>
                  <th>{t('clients.colJoined')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td>{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td className="inv-td-email">@{c.username}</td>
                    <td className="inv-td-email">{c.email}</td>
                    <td className="inv-td-date">{fmt(c.date_joined)}</td>
                    <td className="inv-td-action">
                      <button
                        className="inv-revoke-btn"
                        onClick={() => handleRemoveClient(c.id, c.username)}
                        disabled={removing === c.id}
                      >
                        {removing === c.id ? t('clients.removing') : t('clients.remove')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email Configuration */}
      <div className="clients-card">
        <div className="clients-card-title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          {t('clients.emailSetup')}
        </div>

        {cfgLoading ? (
          <p className="clients-muted">{t('clients.loading')}</p>
        ) : emailCfg ? (
          <div className="cfg-status-row">
            <div className="cfg-status-ok">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {t('clients.sentFrom')} <strong>{emailCfg.from_email}</strong>
              {emailCfg.is_verified
                ? <span className="cfg-verified-badge">{t('clients.verified')}</span>
                : <span className="cfg-unverified-badge">{t('clients.unverified')}</span>}
            </div>
            <div className="cfg-status-actions">
              <button className="cfg-btn-edit" onClick={() => {
                setAppPassword('');
                setCfgMsg('');
                setCfgError('');
                setCfgOpen(true);
              }}>{t('clients.updatePassword')}</button>
              <button className="cfg-btn-remove" onClick={handleRemoveEmailCfg} disabled={cfgRemoving}>
                {cfgRemoving ? t('clients.revoking') : t('clients.remove')}
              </button>
            </div>
          </div>
        ) : (
          <div className="cfg-warn-banner">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {t('clients.emailBanner')}
            <button className="cfg-btn-setup" onClick={() => {
              setAppPassword('');
              setCfgMsg('');
              setCfgError('');
              setCfgOpen(true);
            }}>
              {t('clients.setupNow')}
            </button>
          </div>
        )}

        {cfgMsg && (
          <div className={cfgMsg.toLowerCase().includes('not') || cfgMsg.toLowerCase().includes('warn') || cfgMsg.toLowerCase().includes('fail')
            ? 'clients-msg-warn' : 'clients-msg-ok'} style={{ marginTop: 12 }}>
            {cfgMsg}
          </div>
        )}
        {cfgError && <div className="clients-msg-err" style={{ marginTop: 12 }}>{cfgError}</div>}

        {cfgOpen && (
          <div className="cfg-form">
            <div className="cfg-sender-row">
              <span className="cfg-sender-label">Sending from</span>
              <span className="cfg-sender-email">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                {emailCfg?.from_email || specialistEmail || 'your registered email'}
              </span>
            </div>

            <div className="cfg-form-group">
              <label>
                Gmail App Password
                {emailCfg && <span className="cfg-pw-hint"> — leave blank to keep existing</span>}
              </label>
              <input
                type="password"
                value={appPassword}
                onChange={e => { setAppPassword(e.target.value); setCfgError(''); }}
                placeholder={emailCfg ? '••••••••••••' : 'xxxx xxxx xxxx xxxx'}
                autoComplete="new-password"
              />
            </div>

            <div className="cfg-hint-box">
              <div className="cfg-hint-title">How to get a Gmail App Password</div>
              <ol className="cfg-hint-steps">
                <li>Go to your <strong>Google Account</strong> → <strong>Security</strong></li>
                <li>Under "How you sign in to Google", enable <strong>2-Step Verification</strong> (required)</li>
                <li>Search for <strong>"App passwords"</strong> in your Google Account settings</li>
                <li>Select app: <strong>Mail</strong> → click <strong>Generate</strong></li>
                <li>Copy the 16-character password and paste it above</li>
              </ol>
              <p className="cfg-hint-note">This is different from your regular Gmail password and only gives access to sending email.</p>
            </div>

            <div className="cfg-form-actions">
              <button className="cfg-btn-save" onClick={handleSaveEmailCfg} disabled={cfgSaving}>
                {cfgSaving ? t('clients.sending') : t('common.save')}
              </button>
              <button className="cfg-btn-cancel" onClick={() => setCfgOpen(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Send Invitation */}
      <div className="clients-card">
        <div className="clients-card-title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          {t('clients.inviteTitle')}
        </div>

        {sendMsg && <div className="clients-msg-ok">{sendMsg}</div>}
        {sendError && <div className="clients-msg-err">{sendError}</div>}

        <div className="invite-input-row">
          <input
            type="email"
            className="invite-email-input"
            value={emailInput}
            onChange={e => { setEmailInput(e.target.value); setSendError(''); }}
            placeholder={t('clients.invitePlaceholder')}
            onKeyDown={e => e.key === 'Enter' && handleSendInvitation()}
          />
          <button className="invite-send-btn" onClick={handleSendInvitation} disabled={sending}>
            {sending ? t('clients.sending') : t('clients.sendInvitation')}
          </button>
        </div>
      </div>

      {/* Pending Invitations */}
      {(invitations.filter(i => i.status === 'pending').length > 0 || invLoading) && (
        <div className="clients-card">
          <div className="clients-card-title">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            {t('clients.pendingTitle')}
            {pendingCount > 0 && <span className="inv-chip-pending">{pendingCount}</span>}
          </div>

          {invError && <div className="clients-msg-err">{invError}</div>}

          {invLoading ? (
            <p className="clients-muted">{t('clients.loading')}</p>
          ) : (
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>{t('clients.colClientEmail')}</th>
                    <th>{t('clients.colStatus')}</th>
                    <th>{t('clients.colSent')}</th>
                    <th>{t('clients.colExpires')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.filter(i => i.status === 'pending').map(inv => (
                    <tr key={inv.id}>
                      <td className="inv-td-email">{inv.client_email || '—'}</td>
                      <td><StatusBadge status={inv.status} t={t} /></td>
                      <td className="inv-td-date">{fmt(inv.created_at)}</td>
                      <td className="inv-td-date">{fmt(inv.expires_at)}</td>
                      <td className="inv-td-action">
                        <button
                          className="inv-revoke-btn"
                          onClick={() => handleRevoke(inv.id)}
                          disabled={revoking === inv.id}
                        >
                          {revoking === inv.id ? t('clients.revoking') : t('clients.revoke')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Clients;
