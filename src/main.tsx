import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// Deliberately not wrapped in StrictMode: its double-invoked effects would
// join and immediately leave the WebRTC room on every mount, and Trystero
// returns the same room instance for a given namespace, so the second join
// would be torn down by the first cleanup.
createRoot(container).render(<App />);
