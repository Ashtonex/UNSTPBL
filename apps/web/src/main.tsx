import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Register PWA Service Worker for offline capability & browser installation
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

// Initialize Sentry — replay is lazy-added after first paint to keep startup fast
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    replaysSessionSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE || '0.05'),
    replaysOnErrorSampleRate: 1.0,
  });

  // Lazy-load the replay integration after 4 s so it doesn't block first paint
  setTimeout(() => {
    import('@sentry/react').then(({ replayIntegration }) => {
      Sentry.addIntegration(replayIntegration());
    });
  }, 4000);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
