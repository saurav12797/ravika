import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useUiStore } from '@/stores/uiStore';

/** Syncs OS reduce-motion preference into uiStore and returns the effective flag. */
export function useReducedMotion(): boolean {
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const setReducedMotion = useUiStore((s) => s.setReducedMotion);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted && enabled) {
        setReducedMotion(true);
      }
    });

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (enabled) {
          setReducedMotion(true);
        }
      },
    );

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [setReducedMotion]);

  return reducedMotion;
}
