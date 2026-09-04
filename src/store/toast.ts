'use client';

import { create } from 'zustand';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: 'info' | 'success' | 'error';
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id' | 'duration' | 'variant'> & Partial<Toast>) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID();
    const entry: Toast = { variant: 'info', duration: 4200, ...toast, id };
    set({ toasts: [...get().toasts, entry] });
    setTimeout(() => get().dismiss(id), entry.duration);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  info: (title: string, description?: string) => useToasts.getState().push({ title, description }),
  success: (title: string, description?: string) =>
    useToasts.getState().push({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    useToasts.getState().push({ title, description, variant: 'error' }),
};
