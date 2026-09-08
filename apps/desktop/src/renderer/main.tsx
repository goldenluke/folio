import { createRoot } from 'react-dom/client';

import { App } from './app.js';
import './style.css';
import 'pdfjs-dist/web/pdf_viewer.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Elemento #root não encontrado.');

createRoot(root).render(<App />);
