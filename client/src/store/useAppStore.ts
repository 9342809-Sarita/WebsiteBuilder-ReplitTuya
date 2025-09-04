import { create } from "zustand";

interface AppState {
  devices: any[];
  selection: string[];
  setDevices: (devices: any[]) => void;
  toggle: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  devices: [],
  selection: [],
  setDevices: (d) => set({ devices: d }),
  toggle: (id) => {
    const cur = get().selection;
    set({ selection: cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id] });
  }
}));