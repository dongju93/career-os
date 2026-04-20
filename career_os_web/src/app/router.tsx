import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from '../components/app-layout';
import { ProtectedRoute } from '../components/protected-route';
import { AuthCallbackPage } from '../pages/auth-callback-page';
import { JobPostingsPage } from '../pages/job-postings-page';
import { LoginPage } from '../pages/login-page';
import { NotFoundPage } from '../pages/not-found-page';

export const appRoutes = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Navigate replace to="/job-postings" />,
          },
          {
            path: 'job-postings',
            element: <JobPostingsPage />,
          },
          {
            path: '*',
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
