import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './App.tsx';
import './index.css';
import { queryClient, persister, QUERY_CACHE_BUSTER } from './lib/queryClient';

const root = createRoot(document.getElementById('root')!);

if (persister) {
  root.render(
    <StrictMode>
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
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
