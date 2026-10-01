import { useEffect, useRef, useCallback, useState } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventDefault?: boolean;
}

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

export function useSwipeGestures(elementRef: React.RefObject<HTMLElement | null>, options: SwipeOptions) {
  const { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50, preventDefault = false } = options;
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isTracking = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    isTracking.current = true;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isTracking.current || startX.current === null || startY.current === null) return;
    if (preventDefault) e.preventDefault();
  }, [preventDefault]);

  const handleTouchEnd = useCallback(() => {
    if (!isTracking.current || startX.current === null || startY.current === null) return;
    
    const endX = startX.current;
    const endY = startY.current;
    const deltaX = endX - (startX.current);
    const deltaY = endY - (startY.current);
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (Math.max(absX, absY) < threshold) {
      isTracking.current = false;
      return;
    }

    if (absX > absY) {
      if (deltaX > 0 && onSwipeRight) onSwipeRight();
      else if (deltaX < 0 && onSwipeLeft) onSwipeLeft();
    } else {
      if (deltaY > 0 && onSwipeDown) onSwipeDown();
      else if (deltaY < 0 && onSwipeUp) onSwipeUp();
    }

    isTracking.current = false;
    startX.current = null;
    startY.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: !preventDefault });
    el.addEventListener('touchmove', handleTouchMove, { passive: !preventDefault });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd, preventDefault]);
}

export function usePullToRefresh(elementRef: React.RefObject<HTMLElement | null>, options: PullToRefreshOptions) {
  const { onRefresh, threshold = 80, maxPull = 120 } = options;
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const isTracking = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isRefreshing) return;
    const el = elementRef.current;
    if (!el) return;
    // Só ativa se estiver no topo do scroll
    if (el.scrollTop > 0) return;
    
    const touch = e.touches[0];
    startY.current = touch.clientY;
    isTracking.current = true;
  }, [isRefreshing, elementRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isTracking.current || startY.current === null || isRefreshing) return;
    
    const el = elementRef.current;
    if (el && el.scrollTop > 0) {
      isTracking.current = false;
      return;
    }

    const currentY = e.touches[0].clientY;
    const delta = currentY - startY.current;
    
    if (delta > 0 && el && el.scrollTop <= 0) {
      const distance = Math.min(delta * 0.5, maxPull);
      setPullDistance(distance);
      if (distance > threshold) {
        setIsPulling(true);
      }
    }
  }, [isRefreshing, threshold, maxPull, elementRef]);

  const handleTouchEnd = useCallback(async () => {
    if (!isTracking.current || isRefreshing) return;
    
    if (isPulling && pullDistance > threshold) {
      setIsRefreshing(true);
      setIsPulling(false);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
    
    isTracking.current = false;
    startY.current = null;
  }, [isRefreshing, isPulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { isPulling, pullDistance, isRefreshing };
}

export function useHapticFeedback() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const light = useCallback(() => vibrate(10), [vibrate]);
  const medium = useCallback(() => vibrate(20), [vibrate]);
  const heavy = useCallback(() => vibrate([10, 50, 10]), [vibrate]);
  const success = useCallback(() => vibrate([10, 50, 10, 50, 10]), [vibrate]);
  const error = useCallback(() => vibrate([50, 50, 50]), [vibrate]);

  return { vibrate, light, medium, heavy, success, error };
}