import { useSyncExternalStore } from 'react';
import { AmigoMark } from './Amigo';

// Сквозной слой гл.08 §1: индикатор online/offline в шапке каждого экрана.
// P0 — только статус сети; счётчик непушнутых правок появится с синком.
// §10.2: компактная марка Amigo живёт здесь — «офлайн = без усов»
// (единственное исключение из «усы всегда вверх», §10.3).

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
      <AmigoMark size={16} withStache={online} />
      {online ? 'онлайн' : 'офлайн'}
    </span>
  );
}
