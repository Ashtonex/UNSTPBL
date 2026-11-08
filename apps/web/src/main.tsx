import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { prewarmApi } from './lib/api';
import { captureException, initMonitoring } from './lib/monitoring';
import { PERSIST_BUSTER, PERSIST_MAX_AGE_MS, persister, shouldPersistQuery } from './lib/persistedCache';
import '@fontsource-variable/inter';
import './index.css';

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
      // Saved data (see persistedCache.ts) must be kept in memory at least as long as it may be shown.
      gcTime: PERSIST_MAX_AGE_MS,
    },
  },
});

function CrashScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-surface-950 text-white p-6 text-center">
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
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: PERSIST_MAX_AGE_MS,
          buster: PERSIST_BUSTER,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) && shouldPersistQuery(query.queryKey),
          },
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
