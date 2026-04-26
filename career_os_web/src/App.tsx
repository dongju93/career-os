import { Analytics } from '@vercel/analytics/react';
import { RouterProvider } from 'react-router';
import { router } from './app/router';

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Analytics />
    </>
  );
}

export default App;
