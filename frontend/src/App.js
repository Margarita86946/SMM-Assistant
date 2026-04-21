import React, { useEffect, useRef } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PostsList from './components/PostsList';
import CreatePost from './components/CreatePost';
import EditPost from './components/EditPost';
import Calendar from './components/Calendar';
import NotFound from './components/NotFound';
import ContentGenerator from './components/ContentGenerator';
import Account from './components/Account';
import ClientDashboard from './components/ClientDashboard';
import Clients from './components/Clients';
import AcceptInvitation from './components/AcceptInvitation';
import Sidebar from './components/Sidebar';
import { NotificationBell, NotificationToast } from './components/NotificationBell';
import { ActiveClientProvider } from './context/ActiveClientContext';
import { NotificationsProvider } from './context/NotificationsContext';
import './App.css';

function RouteTracker() {
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      sessionStorage.setItem('previousPath', prevPath.current);
      prevPath.current = location.pathname;
    }
  }, [location.pathname]);

  return null;
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <NotificationBell />
        {children}
      </main>
    </div>
  );
}

function homeForRole(role) {
  if (role === 'client') return '/client';
  return '/dashboard';
}

function PublicRoute({ children }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (token) return <Navigate to={homeForRole(role)} replace />;
  return children;
}

function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  const expiresAt = localStorage.getItem('token_expires_at');
  if (expiresAt && new Date(expiresAt) < new Date()) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('token_expires_at');
    localStorage.removeItem('role');
    localStorage.removeItem('activeClientId');
    localStorage.removeItem('notifications_sound');
    return <Navigate to="/login" replace />;
  }
  const role = localStorage.getItem('role');
  const path = location.pathname;

  // client can only access /client and /account
  const CLIENT_ALLOWED = ['/client', '/account'];
  if (role === 'client' && !CLIENT_ALLOWED.some(p => path.startsWith(p))) {
    return <Navigate to="/client" replace />;
  }
  // owner cannot access /clients (specialist-only)
  if (role === 'owner' && path.startsWith('/clients')) {
    return <Navigate to="/dashboard" replace />;
  }
  // specialist and owner cannot access /client (client-only)
  if (role !== 'client' && path === '/client') {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function RootLayout() {
  return (
    <>
      <RouteTracker />
      <div className="App">
        <Outlet />
      </div>
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Navigate to="/login" replace /> },
      { path: '/login', element: <PublicRoute><Login isLoginMode={true} /></PublicRoute> },
      { path: '/register', element: <PublicRoute><Login isLoginMode={false} /></PublicRoute> },
      { path: '/dashboard', element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
      { path: '/client', element: <ProtectedRoute><ClientDashboard /></ProtectedRoute> },
      { path: '/posts', element: <ProtectedRoute><PostsList /></ProtectedRoute> },
      { path: '/create', element: <ProtectedRoute><CreatePost /></ProtectedRoute> },
      { path: '/edit/:id', element: <ProtectedRoute><EditPost /></ProtectedRoute> },
      { path: '/calendar', element: <ProtectedRoute><Calendar /></ProtectedRoute> },
      { path: '/generate', element: <ProtectedRoute><ContentGenerator /></ProtectedRoute> },
      { path: '/account', element: <ProtectedRoute><Account /></ProtectedRoute> },
      { path: '/clients', element: <ProtectedRoute><Clients /></ProtectedRoute> },
      { path: '/accept-invitation/:token', element: <AcceptInvitation /> },
      { path: '/accept-invitation', element: <AcceptInvitation /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

function App() {
  return (
    <ActiveClientProvider>
      <NotificationsProvider>
        <RouterProvider router={router} />
        <NotificationToast />
      </NotificationsProvider>
    </ActiveClientProvider>
  );
}

export default App;
