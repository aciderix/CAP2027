import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './App.tsx';
import './index.css';
import { queryClient, persister, QUERY_CACHE_BUSTER } from './lib/queryClient';

const root = createRoot(document.getElementById('root')!);

// BrowserRouter wraps the app on both web and Capacitor — the Android
// WebView supports the History API, so deep links like /explorer/candidats
// work identically. URL ↔ activeTab/explorerView sync happens inside
// App.tsx itself; child components keep using setActiveTab as before.

if (persister) {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: 24 * 60 * 60 * 1000,
            buster: QUERY_CACHE_BUSTER,
          }}
        >
          <App />
        </PersistQueryClientProvider>
      </BrowserRouter>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}
