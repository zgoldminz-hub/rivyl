import { create } from "zustand";

interface ToastState {
  message: string | null;
  type: "success" | "error" | "info";
  show: (message: string, type?: "success" | "error" | "info") => void;
  dismiss: () => void;
}

let timer: ReturnType<typeof setTimeout>;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: "success",
  show(message, type = "success") {
    clearTimeout(timer);
    set({ message, type });
    timer = setTimeout(() => set({ message: null }), 3500);
  },
  dismiss() {
    clearTimeout(timer);
    set({ message: null });
  },
}));

// Convenience hook that just returns the `show` function
export function useToast() {
  return useToastStore((s) => s.show);
}
