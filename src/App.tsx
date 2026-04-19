import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutDashboard, Link as LinkIcon, List, Archive, BarChart2, FileText, Menu, X, Settings as Settings2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Toaster } from 'sonner';

import Dashboard from './pages/Dashboard';
import Slots from './pages/Slots';
import Offers from './pages/Offers';
import ArchivePage from './pages/Archive';
import Analysis from './pages/Analysis';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import NotificationsPanel from './components/NotificationsPanel';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const queryClient = new QueryClient();

function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (v: boolean) => void }) {
  const location = useLocation();
  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Panel główny' },
    { to: '/slots', icon: LinkIcon, label: 'Sloty wyszukiwania' },
    { to: '/offers', icon: List, label: 'Aktywne ogłoszenia' },
    { to: '/archive', icon: Archive, label: 'Archiwum ofert' },
    { to: '/analysis', icon: BarChart2, label: 'Analiza rynku' },
    { to: '/logs', icon: FileText, label: 'Dziennik zdarzeń' },
    { to: '/settings', icon: Settings2, label: 'Ustawienia systemu' },
  ];

  const appName = 'OLX Tracker Pro';

  return (
    <>
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 bg-surface border-r border-border h-screen flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 pt-16 md:pt-0 shadow-2xl md:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden md:flex flex-col p-8 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center font-bold text-black shadow-lg shadow-brand/20">
              {appName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-text leading-none whitespace-nowrap">{appName}</h1>
              <p className="text-[10px] text-text-muted font-mono mt-1 uppercase tracking-widest">System Monitoringu</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-brand/10 text-brand shadow-sm" 
                    : "text-gray-400 hover:bg-surface-hover hover:text-white"
                )}
              >
                <Icon size={20} className={cn("transition-transform group-hover:scale-110", isActive ? "text-brand" : "text-gray-500")} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden mt-16"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await axios.get('/api/settings')).data,
    staleTime: Infinity
  });

  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      
      const applyTheme = (isDark: boolean, currentSettings: any) => {
        const primary = currentSettings.theme_primary || '#F5A623';
        let bg = currentSettings.theme_bg;
        let surface = currentSettings.theme_surface;
        let border = currentSettings.theme_border;
        let text = currentSettings.theme_text;
        let textMuted = currentSettings.theme_text_muted;
        let effectiveIsDark = isDark;

        if (currentSettings.theme_mode === 'system') {
          if (isDark) {
            bg = '#0F172A';
            surface = '#1E293B';
            border = '#334155';
            text = '#FFFFFF';
            textMuted = '#9CA3AF';
          } else {
            bg = '#FFFFFF';
            surface = '#F9FAFB';
            border = '#E5E7EB';
            text = '#111827';
            textMuted = '#6B7280';
          }
        } else {
          effectiveIsDark = currentSettings.theme_mode === 'dark';
        }

        // Apply dark/light class for Tailwind and color-scheme
        if (effectiveIsDark) {
          root.classList.add('dark');
          root.classList.remove('light');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
          root.style.colorScheme = 'light';
        }

        if (primary) root.style.setProperty('--theme-primary', primary);
        if (bg) root.style.setProperty('--theme-bg', bg);
        if (surface) root.style.setProperty('--theme-surface', surface);
        if (border) root.style.setProperty('--theme-border', border);
        if (text) root.style.setProperty('--theme-text', text);
        if (textMuted) root.style.setProperty('--theme-text-muted', textMuted);
      };

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches, settings);

      const listener = (e: MediaQueryListEvent) => {
        if (settings.theme_mode === 'system') {
          applyTheme(e.matches, settings);
        }
      };

      mediaQuery.addEventListener('change', listener);
      
      if (settings.glass_morphism) {
        root.style.setProperty('--glass-blur', settings.glass_morphism === 'true' ? '12px' : '0px');
        root.setAttribute('data-glass', settings.glass_morphism);
      }
      
      // Cache theme settings for flash prevention script
      const themeCache = {
        primary: settings.theme_primary,
        bg: settings.theme_bg,
        surface: settings.theme_surface,
        border: settings.theme_border,
        text: settings.theme_text,
        text_muted: settings.theme_text_muted,
        mode: settings.theme_mode,
        glass: settings.glass_morphism
      };
      localStorage.setItem('olx_tracker_theme', JSON.stringify(themeCache));

      document.title = 'OLX Tracker Pro';
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings]);

  const appName = 'OLX Tracker Pro';

  return (
    <div className="flex h-screen bg-bg text-text font-sans overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-surface border-b border-border flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center font-bold text-black">
            {appName.substring(0, 2).toUpperCase()}
          </div>
          <span className="font-bold text-text shrink-0">{appName}</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsPanel />
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-text p-2 hover:bg-surface-hover rounded-lg transition-colors">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />
      
      <main className="flex-1 overflow-y-auto bg-bg pt-16 md:pt-0 relative">
        <div className="absolute top-0 right-0 p-6 hidden md:block z-50">
          <NotificationsPanel />
        </div>
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-brand/5 to-transparent pointer-events-none" />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/slots" element={<Slots />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MainLayout />
        <Toaster theme="dark" position="bottom-right" className="font-sans" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
