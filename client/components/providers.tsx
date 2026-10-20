'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, ApiError, body } from '@/lib/api';
import type { User } from '@/lib/types';
type Session = { user: User | null; loading: boolean; sessionError: boolean; refresh: () => Promise<void>; setUser: (user: User | null) => void; logout: () => Promise<void> };
const AuthContext = createContext<Session>({ user: null, loading: true, sessionError: false, refresh: async () => {}, setUser: () => {}, logout: async () => {} });
const ToastContext = createContext<(message: string, error?: boolean) => void>(() => {});
export const useAuth = () => useContext(AuthContext);
export const useToast = () => useContext(ToastContext);
export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true); const [sessionError, setSessionError] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);
  const refresh = useCallback(async () => {
    try { setUser(await api<User>('/auth/me')); setSessionError(false); }
    catch (error) { if (error instanceof ApiError && error.status === 401) { setUser(null); setSessionError(false); } else setSessionError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 5500); return () => clearTimeout(timer); }, [toast]);
  const logout = async () => { try { await api('/auth/logout', { method: 'POST', body: body({}) }); setUser(null); } catch (error) { notify((error as Error).message, true); } };
  return <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}><AuthContext.Provider value={{ user, loading, sessionError, refresh, setUser, logout }}><ToastContext.Provider value={notify}>{children}{toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}<span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={18}/></button></div>}</ToastContext.Provider></AuthContext.Provider></ThemeProvider>;
}
