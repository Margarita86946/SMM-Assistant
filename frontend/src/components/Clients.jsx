import React, { useState, useEffect } from 'react';
import { invitationsAPI, clientsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import { useActiveClient } from '../context/ActiveClientContext';
import { FiUsers, FiUser, FiSend, FiMail, FiInstagram, FiChevronDown, FiChevronUp } from 'react-icons/fi';
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

function ClientRow({ client, removing, onRemove, fmt, t }) {
  const [expanded, setExpanded] = useState(false);
  const accounts = client.instagram_accounts || [];
  const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.username;

  return (
    <div className="client-row">
      <div className="client-row-main">
        <div className="client-row-avatar">{name.charAt(0).toUpperCase()}</div>
        <div className="client-row-info">
          <span className="client-row-name">{name}</span>
          <span className="client-row-meta">@{client.username} · {client.email}</span>
        </div>
        <span className="client-row-joined">{fmt(client.date_joined)}</span>
        <div className="client-row-actions">
          {accounts.length > 0 && (
            <button
              className="client-ig-toggle"
              onClick={() => setExpanded(e => !e)}
              title="Instagram accounts"
            >
              <FiInstagram />
              <span>{accounts.length}</span>
              {expanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
            </button>
          )}
          {accounts.length === 0 && (
            <span className="client-no-ig">{t('clients.noIgConnected')}</span>
          )}
          <button
            className="inv-revoke-btn"
            onClick={() => onRemove(client.id, client.username)}
            disabled={removing === client.id}
          >
            {removing === client.id ? t('clients.removing') : t('clients.remove')}
          </button>
        </div>
      </div>

      {expanded && accounts.length > 0 && (
        <div className="client-ig-accounts">
          {accounts.map(a => (
            <div key={a.id} className="client-ig-account">
              <FiInstagram className="client-ig-icon" />
              <span className="client-ig-username">@{a.username}</span>
              <span className="client-ig-type">{a.account_type}</span>
              <span className="client-ig-connected">{t('clients.igConnected', { date: fmt(a.connected_at) })}</span>
              {a.token_expires_at && new Date(a.token_expires_at) < new Date() && (
                <span className="client-ig-expired">{t('clients.igTokenExpired')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Clients() {
  const { t } = useTranslation();
  const { language } = useSettings();
  const locale = LOCALE_MAP[language] || 'en-US';
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

  const [removing, setRemoving] = useState(null);


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

  useEffect(() => {
    loadClients();
    loadInvitations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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


  const fmt = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
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
          <FiUsers />
          {t('clients.connectedTitle')}
          {clients.length > 0 && (
            <span className="inv-chip-accepted">{clients.length}</span>
          )}
        </div>

        {clientsLoading ? (
          <p className="clients-muted">{t('clients.loading')}</p>
        ) : clients.length === 0 ? (
          <div className="inv-empty">
            <FiUser />
            <p>{t('clients.noClients')}</p>
          </div>
        ) : (
          <div className="client-rows">
            {clients.map(c => (
              <ClientRow
                key={c.id}
                client={c}
                removing={removing}
                onRemove={handleRemoveClient}
                fmt={fmt}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* Send Invitation */}
      <div className="clients-card">
        <div className="clients-card-title">
          <FiSend />
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
            <FiMail />
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
                  </tr>
                </thead>
                <tbody>
                  {invitations.filter(i => i.status === 'pending').map(inv => (
                    <tr key={inv.id}>
                      <td className="inv-td-email">{inv.client_email || '—'}</td>
                      <td><StatusBadge status={inv.status} t={t} /></td>
                      <td className="inv-td-date">{fmt(inv.created_at)}</td>
                      <td className="inv-td-date">{fmt(inv.expires_at)}</td>
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
