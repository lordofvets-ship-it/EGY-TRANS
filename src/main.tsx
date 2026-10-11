import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {LoginGate} from './components/LoginGate.tsx';
import {installAuthFetch} from './utils/authClient.ts';
import './index.css';

installAuthFetch();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoginGate>
      <App />
    </LoginGate>
  </StrictMode>,
);
