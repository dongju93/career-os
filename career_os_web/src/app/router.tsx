import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from '../components/app-layout';
import { ProtectedRoute } from '../components/protected-route';
import { RouteErrorBoundary } from '../components/route-error-boundary';
import { AuthCallbackPage } from '../pages/auth-callback-page';
import { LoginPage } from '../pages/login-page';
import { NotFoundPage } from '../pages/not-found-page';

const JobPostingsPage = lazy(() =>
  import('../pages/job-postings-page').then((m) => ({
    default: m.JobPostingsPage,
  })),
);
const AddJobPostingPage = lazy(() =>
  import('../pages/add-job-posting-page').then((m) => ({
    default: m.AddJobPostingPage,
  })),
);
const JobPostingDetailPage = lazy(() =>
  import('../pages/job-posting-detail-page').then((m) => ({
    default: m.JobPostingDetailPage,
  })),
);

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
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorBoundary />,
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
            path: 'job-postings/new',
            element: <AddJobPostingPage />,
          },
          {
            path: 'job-postings/:id',
            element: <JobPostingDetailPage />,
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
