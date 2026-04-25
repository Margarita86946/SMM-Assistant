import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invitationsAPI } from '../services/api';
import SmmLogo from './SmmLogo';
import { FiX, FiUser } from 'react-icons/fi';
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
              <FiX />
            </div>
            <h2 className="accept-result-title">Invalid Invitation</h2>
            <p className="accept-result-msg">{error}</p>
          </div>
        )}

        {!loading && !error && invitation && (
          <>
            <div className="accept-ig-icon">
              <FiUser />
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
