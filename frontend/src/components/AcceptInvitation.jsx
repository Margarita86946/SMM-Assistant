import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { invitationsAPI } from '../services/api';
import SmmLogo from './SmmLogo';
import '../styles/AcceptInvitation.css';

const RESULT_CONFIG = {
  connected: {
    icon: 'success',
    title: 'Instagram Connected!',
    message: 'Your Instagram account has been connected. The specialist can now schedule and publish posts on your behalf.',
  },
  error: {
    icon: 'error',
    title: 'Something Went Wrong',
    message: 'The connection could not be completed. The invitation link may have expired or already been used. Please contact the specialist.',
  },
  expired: {
    icon: 'error',
    title: 'Invitation Expired',
    message: 'This invitation has expired. Please ask the specialist to send you a new invitation.',
  },
  personal: {
    icon: 'warn',
    title: 'Business Account Required',
    message: 'Your Instagram account must be a Business or Creator account. Switch your Instagram to a Professional account and try again.',
  },
};

function AcceptInvitation() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const result = searchParams.get('result');

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!token) return;
    invitationsAPI.lookup(token)
      .then(res => setInvitation(res.data))
      .catch(() => setError('This invitation link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await invitationsAPI.startOAuth(token);
      window.location.href = res.data.oauth_url;
    } catch (err) {
      setError(err.message || 'Could not start Instagram connection. Please try again.');
      setConnecting(false);
    }
  };

  const resultInfo = result ? RESULT_CONFIG[result] : null;

  return (
    <div className="accept-page">
      <div className="accept-card">
        {/* Logo */}
        <div className="accept-logo">
          <div className="accept-logo-icon">
            <SmmLogo size={36} />
          </div>
          <span className="accept-logo-text">SMM Assistant</span>
        </div>

        {/* Result state (after OAuth callback) */}
        {resultInfo && (
          <div className={`accept-result accept-result--${resultInfo.icon}`}>
            {resultInfo.icon === 'success' && (
              <div className="accept-result-icon accept-result-icon--success">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            )}
            {resultInfo.icon === 'error' && (
              <div className="accept-result-icon accept-result-icon--error">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </div>
            )}
            {resultInfo.icon === 'warn' && (
              <div className="accept-result-icon accept-result-icon--warn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
            )}
            <h2 className="accept-result-title">{resultInfo.title}</h2>
            <p className="accept-result-msg">{resultInfo.message}</p>
          </div>
        )}

        {/* Initial invitation view (with token, no result yet) */}
        {!resultInfo && (
          <>
            {loading && (
              <div className="accept-loading">
                <div className="accept-spinner" />
                <p>Loading invitation…</p>
              </div>
            )}

            {!loading && error && (
              <div className="accept-error-state">
                <div className="accept-result-icon accept-result-icon--error">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </div>
                <h2 className="accept-result-title">Invalid Invitation</h2>
                <p className="accept-result-msg">{error}</p>
              </div>
            )}

            {!loading && !error && invitation && (
              <>
                <div className="accept-ig-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </div>

                <h2 className="accept-title">You've been invited</h2>
                <p className="accept-specialist">
                  <strong>{invitation.specialist_name}</strong> has invited you to connect your Instagram account
                  so they can manage your social media posts on your behalf.
                </p>

                {invitation.client_email && (
                  <div className="accept-email-chip">
                    Invitation for <strong>{invitation.client_email}</strong>
                  </div>
                )}

                <div className="accept-steps">
                  <div className="accept-step">
                    <span className="accept-step-num">1</span>
                    <span>Click the button below to go to Instagram</span>
                  </div>
                  <div className="accept-step">
                    <span className="accept-step-num">2</span>
                    <span>Log in and authorize the connection</span>
                  </div>
                  <div className="accept-step">
                    <span className="accept-step-num">3</span>
                    <span>Your account will be linked automatically</span>
                  </div>
                </div>

                <div className="accept-requirement">
                  Your Instagram must be a <strong>Business</strong> or <strong>Creator</strong> account.
                </div>

                {error && <div className="accept-inline-error">{error}</div>}

                <button
                  className="accept-connect-btn"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <div className="accept-btn-spinner" />
                      Redirecting to Instagram…
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                      </svg>
                      Connect with Instagram
                    </>
                  )}
                </button>

                {invitation.expires_at && (
                  <p className="accept-expiry">
                    Invitation expires {new Date(invitation.expires_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AcceptInvitation;
