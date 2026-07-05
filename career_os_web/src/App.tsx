import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { RouterProvider } from 'react-router';
import { router } from './app/router';

// Vercel web-analytics and Speed Insights (Core Web Vitals) only report from
// deployed Vercel environments. Gating them behind a production build keeps
// their scripts and beacons out of local dev, where they cannot function and
// only add startup cost.
const observabilityEnabled = import.meta.env.PROD;

function App() {
  return (
    <>
      <RouterProvider router={router} />
      {observabilityEnabled && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
    </>
  );
}

export default App;
