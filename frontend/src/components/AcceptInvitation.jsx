import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invitationsAPI } from '../services/api';
import SmmLogo from './SmmLogo';
import '../styles/AcceptInvitation.css';

function AcceptInvitation() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No invitation token found.');
      setLoading(false);
      return;
    }
    invitationsAPI.lookup(token)
      .then(res => setInvitation(res.data))
      .catch(() => setError('This invitation link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = () => {
    navigate(`/register?token=${token}`);
  };

  return (
    <div className="accept-page">
      <div className="accept-card">
        <div className="accept-logo">
          <div className="accept-logo-icon">
            <SmmLogo size={36} />
          </div>
          <span className="accept-logo-text">SMM Assistant</span>
        </div>

        {loading && (
          <div className="accept-loading">
            <div className="accept-spinner" />
            <p>Loading invitation…</p>
          </div>
        )}

        {!loading && error && (
          <div className="accept-result accept-result--error">
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
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>

            <h2 className="accept-title">You've been invited</h2>
            <p className="accept-specialist">
              <strong>{invitation.specialist_name}</strong> has invited you to join SMM Assistant
              as their client so they can create and manage social media posts on your behalf.
            </p>

            {invitation.client_email && (
              <div className="accept-email-chip">
                Invitation for <strong>{invitation.client_email}</strong>
              </div>
            )}

            <div className="accept-steps">
              <div className="accept-step">
                <span className="accept-step-num">1</span>
                <span>Create your account — your email is pre-filled</span>
              </div>
              <div className="accept-step">
                <span className="accept-step-num">2</span>
                <span>You'll be linked to {invitation.specialist_name} automatically</span>
              </div>
              <div className="accept-step">
                <span className="accept-step-num">3</span>
                <span>Connect your Instagram from your Account page anytime</span>
              </div>
            </div>

            <button className="accept-connect-btn" onClick={handleAccept}>
              Create your account →
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
      </div>
    </div>
  );
}

export default AcceptInvitation;
