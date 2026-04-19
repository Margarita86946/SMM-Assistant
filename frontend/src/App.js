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
import Sidebar from './components/Sidebar';
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
        {children}
      </main>
    </div>
  );
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
    return <Navigate to="/login" replace />;
  }
  if (localStorage.getItem('role') === 'client' && location.pathname === '/dashboard') {
    return <Navigate to="/client" replace />;
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
      { path: '/login', element: <Login isLoginMode={true} /> },
      { path: '/register', element: <Login isLoginMode={false} /> },
      { path: '/dashboard', element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
      { path: '/client', element: <ProtectedRoute><ClientDashboard /></ProtectedRoute> },
      { path: '/posts', element: <ProtectedRoute><PostsList /></ProtectedRoute> },
      { path: '/create', element: <ProtectedRoute><CreatePost /></ProtectedRoute> },
      { path: '/edit/:id', element: <ProtectedRoute><EditPost /></ProtectedRoute> },
      { path: '/calendar', element: <ProtectedRoute><Calendar /></ProtectedRoute> },
      { path: '/generate', element: <ProtectedRoute><ContentGenerator /></ProtectedRoute> },
      { path: '/account', element: <ProtectedRoute><Account /></ProtectedRoute> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
