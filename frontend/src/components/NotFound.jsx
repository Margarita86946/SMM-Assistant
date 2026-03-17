import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import '../styles/NotFound.css';

function NotFound() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isLoggedIn = localStorage.getItem('token');

  const handleGoBack = () => {
    if (isLoggedIn) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="not-found">
      <h1 className="not-found__code">404</h1>
      <h2 className="not-found__title">{t('notFound.title')}</h2>
      <p className="not-found__message">{t('notFound.message')}</p>
      <button className="not-found__btn" onClick={handleGoBack}>
        {isLoggedIn ? t('notFound.goToDashboard') : t('notFound.goToLogin')}
      </button>
    </div>
  );
}

export default NotFound;
