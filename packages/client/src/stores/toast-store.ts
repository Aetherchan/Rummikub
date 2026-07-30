/**
 * 轻量级 Toast 消息状态管理。
 *
 * 使用:
 *   import { useToastStore } from '../stores/toast-store';
 *   useToastStore.getState().toast({ type: 'error', message: '出错了' });
 */

import { create } from 'zustand';
import type { ToastMessage, ToastType } from '../components/ui/Toast';

let _nextId = 0;
function nextId(): string {
  return `toast-${++_nextId}-${Date.now()}`;
}

interface ToastState {
  toasts: ToastMessage[];
  toast: (opts: { type: ToastType; message: string; duration?: number }) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  toast: ({ type, message, duration }) => {
    const id = nextId();
    const toast: ToastMessage = { id, type, message, duration };

    set(s => ({
      toasts: [...s.toasts.slice(-4), toast], // keep max 5
    }));

    // Auto-dismiss
    const timeout = duration ?? 3000;
    if (timeout > 0) {
      setTimeout(() => {
        get().dismiss(id);
      }, timeout);
    }
  },

  dismiss: (id) => set(s => ({
    toasts: s.toasts.filter(t => t.id !== id),
  })),

  clearAll: () => set({ toasts: [] }),
}));
