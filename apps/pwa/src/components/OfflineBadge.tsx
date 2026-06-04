import { useSyncExternalStore } from 'react';

// Сквозной слой гл.08 §1: индикатор online/offline в шапке каждого экрана.
// P0 — только статус сети; счётчик непушнутых правок появится с синком.

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function OfflineBadge() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return (
    <span className={online ? 'offline-badge' : 'offline-badge offline'}>
      {online ? 'онлайн' : 'офлайн'}
    </span>
  );
}
