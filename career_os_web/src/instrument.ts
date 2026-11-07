import * as Sentry from '@sentry/react';
import { reactRouterBrowserTracingIntegration } from '@sentry/react/react-router';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [reactRouterBrowserTracingIntegration()],
  // Sentry 11 widens collection when this is unset; in this browser setup that
  // turns on server-side user IP inference (`infer_ip: auto`). Keep the
  // restrictive SDK 10 baseline, which sends `infer_ip: never`.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    },
    httpBodies: [],
    urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    graphQL: { document: false, variables: false },
  },
  tracesSampleRate: 1.0,
});
