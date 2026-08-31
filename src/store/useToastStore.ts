import { create } from 'zustand';

export type ToastTone = 'default' | 'error';

export interface ToastMessage {
  /** Rises with every toast, so a hide timer only ever ends its own message. */
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toast?: ToastMessage;
  showToast(message: string, tone?: ToastTone): void;
  hideToast(id: number): void;
}

/**
 * Holds the one result message the app has to report. A screen raises a toast
 * and forgets it; the host above the navigator shows it and times it out, so
 * the message survives a screen that unmounts right after the action.
 */
export const useToastStore = create<ToastState>((set) => {
  let lastId = 0;

  return {
    toast: undefined,
    showToast: (message, tone = 'default') =>
      set({ toast: { id: (lastId += 1), message, tone } }),
    hideToast: (id) =>
      set((state) => (state.toast?.id === id ? { toast: undefined } : state)),
  };
});

/** Raises a toast from outside React, such as an event handler in a store. */
export const showToast = (message: string, tone?: ToastTone) =>
  useToastStore.getState().showToast(message, tone);
