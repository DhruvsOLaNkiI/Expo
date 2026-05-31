import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { preconnectR2Cdn } from '@/config/r2Public';
import './index.css';

preconnectR2Cdn();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
