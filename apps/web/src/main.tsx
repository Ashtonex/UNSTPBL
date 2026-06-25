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

// Initialize Sentry
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || 'https://c00a078fcf47893596672eb2c21b4fa6@o4511622101925888.ingest.de.sentry.io/4511622119424080',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

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
