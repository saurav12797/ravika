import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useUiStore } from '@/stores/uiStore';

/** Mirrors NetInfo connectivity into the UI store. */
export function useNetwork(): { offline: boolean } {
  const offline = useUiStore((s) => s.offline);
  const setOffline = useUiStore((s) => s.setOffline);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const isOffline =
        state.isConnected === false || state.isInternetReachable === false;
      setOffline(isOffline);
    });

    void NetInfo.fetch().then((state) => {
      const isOffline =
        state.isConnected === false || state.isInternetReachable === false;
      setOffline(isOffline);
    });

    return unsub;
  }, [setOffline]);

  return { offline };
}
