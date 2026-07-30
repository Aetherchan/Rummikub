/**
 * Toast 通知组件 —— 轻量级消息提示，支持多种类型和自动关闭。
 *
 * 使用方式（通过 store）：
 *   useGameStore.getState().showToast({ type: 'error', message: '操作失败' })
 */

import { useEffect, useState } from 'react';
import { useToastStore } from '../../stores/toast-store';

const TYPE_STYLES = {
  success: {
    bg: 'bg-emerald-700/90',
    border: 'border-emerald-400',
    icon: '✅',
    text: 'text-emerald-100',
  },
  error: {
    bg: 'bg-red-700/90',
    border: 'border-red-400',
    icon: '❌',
    text: 'text-red-100',
  },
  warning: {
    bg: 'bg-amber-700/90',
    border: 'border-amber-400',
    icon: '⚠️',
    text: 'text-amber-100',
  },
  info: {
    bg: 'bg-blue-700/90',
    border: 'border-blue-400',
    icon: 'ℹ️',
    text: 'text-blue-100',
  },
} as const;

export type ToastType = keyof typeof TYPE_STYLES;

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, default 3000
}

function ToastItem({ toast }: { toast: ToastMessage }) {
  const dismiss = useToastStore(s => s.dismiss);
  const [exiting, setExiting] = useState(false);
  const style = TYPE_STYLES[toast.type];
  const duration = toast.duration ?? 3000;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => setExiting(true), duration - 300);
    return () => clearTimeout(timer);
  }, [duration]);

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => dismiss(toast.id), 300);
    return () => clearTimeout(timer);
  }, [exiting, dismiss, toast.id]);

  return (
    <div
      className={[
        style.bg, style.border, style.text,
        'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg',
        'min-w-[280px] max-w-[400px] backdrop-blur-sm',
        exiting ? 'animate-toast-exit' : 'animate-toast-enter',
      ].join(' ')}
      onClick={() => setExiting(true)}
      role="alert"
    >
      <span className="text-lg shrink-0">{style.icon}</span>
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        onClick={(e) => { e.stopPropagation(); setExiting(true); }}
        className="text-white/60 hover:text-white text-xs shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore(s => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
