import { useEffect, useState } from 'react';

/**
 * Minimal hash routing. A full router would be more machinery than this app
 * needs — there are a handful of flat screens and no nested or parameterised
 * routes beyond the room code.
 */
export function useHashRoute(): [string, (next: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'menu';
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = (next: string) => {
    window.location.hash = `/${next}`;
  };

  return [route, navigate];
}
