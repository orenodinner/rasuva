import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NormalizedTask } from '@domain';
import { addUtcDays, formatIsoDate, snapDeltaDays, toUtcDate } from '../utils/ganttMath';

type DragMode = 'move' | 'resize-left' | 'resize-right';

type DragState = {
  mode: DragMode;
  startX: number;
  baseLeft: number;
  baseWidth: number;
  durationDays: number;
  startDate: Date;
  endDate: Date;
};

const MIN_DURATION_DAYS = 1;

const clampResizeDelta = (mode: DragMode, deltaDays: number, maxShrink: number) => {
  if (mode === 'resize-left') {
    return Math.min(deltaDays, maxShrink);
  }
  if (mode === 'resize-right') {
    return Math.max(deltaDays, -maxShrink);
  }
  return deltaDays;
};

export const useTaskInteraction = ({
  task,
  dayWidth,
  barLeft,
  barWidth,
  durationDays,
  onUpdate,
  onSelect
}: {
  task: NormalizedTask | null;
  dayWidth: number;
  barLeft: number;
  barWidth: number;
  durationDays: number;
  onUpdate: (task: NormalizedTask, newStart: string, newEnd: string) => void;
  onSelect?: (task: NormalizedTask) => void;
}) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const pendingRef = useRef<{ left: number; width: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const moveHandlerRef = useRef<((event: MouseEvent) => void) | null>(null);
  const upHandlerRef = useRef<((event: MouseEvent) => void) | null>(null);
  const abortHandlerRef = useRef<(() => void) | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetVisual = useCallback(
    (widthOverride?: number) => {
    const bar = barRef.current;
    if (!bar) {
      return;
    }
    bar.style.transform = '';
    bar.style.width = `${widthOverride ?? barWidth}px`;
    pendingRef.current = null;
  },
    [barWidth]
  );

  const cleanupListeners = useCallback(() => {
    if (moveHandlerRef.current) {
      window.removeEventListener('mousemove', moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
    if (upHandlerRef.current) {
      window.removeEventListener('mouseup', upHandlerRef.current);
      upHandlerRef.current = null;
    }
    if (abortHandlerRef.current) {
      window.removeEventListener('blur', abortHandlerRef.current);
      abortHandlerRef.current = null;
    }
    if (visibilityHandlerRef.current) {
      document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      visibilityHandlerRef.current = null;
    }
  }, []);

  const scheduleVisual = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingRef.current;
      const state = dragStateRef.current;
      const bar = barRef.current;
      if (!pending || !state || !bar) {
        return;
      }
      bar.style.transform = `translateX(${pending.left - state.baseLeft}px)`;
      bar.style.width = `${pending.width}px`;
    });
  }, []);

  const updateVisual = useCallback(
    (deltaX: number) => {
      const state = dragStateRef.current;
      if (!state) {
        return;
      }
      const maxShrink =
        Math.min(state.durationDays, Math.round(state.baseWidth / dayWidth)) - MIN_DURATION_DAYS;
      const snapped = snapDeltaDays(deltaX, dayWidth);
      const clamped = clampResizeDelta(state.mode, snapped, Math.max(0, maxShrink));
      let nextLeft = state.baseLeft;
      let nextWidth = state.baseWidth;

      if (state.mode === 'move') {
        nextLeft = state.baseLeft + clamped * dayWidth;
      } else if (state.mode === 'resize-left') {
        nextLeft = state.baseLeft + clamped * dayWidth;
        nextWidth = state.baseWidth - clamped * dayWidth;
      } else {
        nextWidth = state.baseWidth + clamped * dayWidth;
      }

      pendingRef.current = { left: nextLeft, width: nextWidth };
      scheduleVisual();
    },
    [dayWidth, scheduleVisual]
  );

  const finalize = useCallback(
    (deltaX: number) => {
      const state = dragStateRef.current;
      if (!state || !task) {
        resetVisual(pendingRef.current?.width);
        return;
      }
      const maxShrink =
        Math.min(state.durationDays, Math.round(state.baseWidth / dayWidth)) - MIN_DURATION_DAYS;
      const snapped = snapDeltaDays(deltaX, dayWidth);
      const clamped = clampResizeDelta(state.mode, snapped, Math.max(0, maxShrink));

      let nextStart = state.startDate;
      let nextEnd = state.endDate;

      if (state.mode === 'move') {
        nextStart = addUtcDays(state.startDate, clamped);
        nextEnd = addUtcDays(state.endDate, clamped);
      } else if (state.mode === 'resize-left') {
        nextStart = addUtcDays(state.startDate, clamped);
      } else {
        nextEnd = addUtcDays(state.endDate, clamped);
      }

      resetVisual(pendingRef.current?.width);

      const nextStartIso = formatIsoDate(nextStart);
      const nextEndIso = formatIsoDate(nextEnd);
      if (!nextStartIso || !nextEndIso) {
        return;
      }
      if (nextStartIso === task.start && nextEndIso === task.end) {
        return;
      }
      onUpdate(task, nextStartIso, nextEndIso);
    },
    [dayWidth, onUpdate, resetVisual, task]
  );

  const startDrag = useCallback(
    (event: ReactMouseEvent, mode: DragMode) => {
      if (!task || !task.start || !task.end) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onSelect?.(task);
      cleanupListeners();

      const startDate = toUtcDate(task.start);
      const endDate = toUtcDate(task.end);
      const startX = event.clientX;
      lastClientXRef.current = startX;
      dragStateRef.current = {
        mode,
        startX,
        baseLeft: barLeft,
        baseWidth: barWidth,
        durationDays,
        startDate,
        endDate
      };
      setIsDragging(true);

      const finalizeDrag = (clientX: number) => {
        if (!dragStateRef.current) {
          return;
        }
        cleanupListeners();
        setIsDragging(false);
        finalize(clientX - startX);
        dragStateRef.current = null;
        lastClientXRef.current = null;
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        lastClientXRef.current = moveEvent.clientX;
        updateVisual(moveEvent.clientX - startX);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        finalizeDrag(upEvent.clientX);
      };

      const handleAbort = () => {
        const lastX = lastClientXRef.current ?? startX;
        finalizeDrag(lastX);
      };
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          handleAbort();
        }
      };

      moveHandlerRef.current = handleMouseMove;
      upHandlerRef.current = handleMouseUp;
      abortHandlerRef.current = handleAbort;
      visibilityHandlerRef.current = handleVisibilityChange;
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('blur', handleAbort);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    },
    [
      task,
      onSelect,
      cleanupListeners,
      barLeft,
      barWidth,
      durationDays,
      dayWidth,
      updateVisual,
      finalize
    ]
  );

  const handleMoveStart = useCallback(
    (event: ReactMouseEvent) => startDrag(event, 'move'),
    [startDrag]
  );

  const handleResizeStart = useCallback(
    (direction: 'left' | 'right') => (event: ReactMouseEvent) =>
      startDrag(event, direction === 'left' ? 'resize-left' : 'resize-right'),
    [startDrag]
  );

  useEffect(() => {
    return () => {
      cleanupListeners();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [cleanupListeners]);

  return {
    barRef,
    isDragging,
    handleMoveStart,
    handleResizeStart
  };
};
