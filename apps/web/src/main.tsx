import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { prewarmApi } from './lib/api';
import { captureException, initMonitoring } from './lib/monitoring';
import './index.css';

// Register PWA Service Worker for offline capability & browser installation
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

// Error reporting loads when the browser is idle, after the first paint.
initMonitoring();

// The API sleeps when idle and can take a minute to wake. Poke it now, while the
// visitor is still on the login screen, so it is awake by the time they sign in.
prewarmApi();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function CrashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface-950 text-white p-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-white/50 text-sm max-w-xs">
        Please reload the page. If it keeps happening, let your church admin know.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
      >
        Reload
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<CrashScreen />} onError={captureException}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
