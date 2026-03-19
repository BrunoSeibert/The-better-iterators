import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  isOnboarded: boolean;
  currentLevel: number;
  completedStages: number[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

function getUserFromToken(token: string | null): User | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    if (!payload.user) return null;
    return payload.user;
  } catch {
    return null;
  }
}

const storedToken = localStorage.getItem('token');

export const useAuthStore = create<AuthState>((set) => ({
  user: getUserFromToken(storedToken),
  token: storedToken,
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },
  setUser: (user) => set((state) => ({ ...state, user: { ...state.user!, ...user } as User })),
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
