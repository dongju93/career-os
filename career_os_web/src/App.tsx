import { SpeedInsights } from '@vercel/speed-insights/react';
import { RouterProvider } from 'react-router';
import { router } from './app/router';

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <SpeedInsights />
    </>
  );
}

export default App;
