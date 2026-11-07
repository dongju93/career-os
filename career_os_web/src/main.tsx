// Must stay first: the router is created while App's imports evaluate, and
// Sentry only names routes and traces navigations if it is initialized by then.
import './instrument';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import App from './App';
import { AppProviders } from './app/providers';
import './index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
