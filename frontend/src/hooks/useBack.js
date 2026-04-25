import { useNavigate } from 'react-router-dom';

/**
 * Returns a goBack function that navigates to the previous page in browser
 * history when available, otherwise falls back to the given fallback path.
 */
export function useBack(fallback = '/dashboard') {
  const navigate = useNavigate();
  return () => {
    // sessionStorage.previousPath is set by RouteTracker in App.js on every navigation.
    // If it exists and is different from the current path, it means the user arrived
    // here from within the app — go back in history.
    const prev = sessionStorage.getItem('previousPath');
    if (prev && prev !== window.location.pathname) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };
}
