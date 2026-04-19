import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Settings as SettingsIcon, Palette, Gauge, Bell, Shield, RotateCcw, Save, CheckCircle2, Layout, Sliders, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function Settings() {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await axios.get('/api/settings')).data,
  });

  const [localSettings, setLocalSettings] = useState<any>(null);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (updates: any) => await axios.patch('/api/settings', updates),
    onSuccess: (data, variables) => {
      // Optimistically update the cache
      queryClient.setQueryData(['settings'], (old: any) => ({ ...old, ...variables }));
      // Optional: show a mini success indicator instead of a full toast for instant saves
      // if you want to keep the user informed.
    }
  });

  if (isLoading || !localSettings) {
    return (
      <div className="p-10 flex items-center justify-center min-h-screen">
        <div className="animate-spin text-brand"><RotateCcw size={40} /></div>
      </div>
    );
  }

  const handleChange = (key: string, value: any) => {
    const newVal = String(value);
    const updated = { ...localSettings, [key]: newVal };
    setLocalSettings(updated);
    
    // All settings in this view now save immediately
    saveMutation.mutate({ [key]: newVal });
  };

  const bgOptions = [
    { name: 'Nocny granat', value: '#0F172A', mode: 'dark' },
    { name: 'Głęboka czerń', value: '#000000', mode: 'dark' },
    { name: 'Czysta biel', value: '#FFFFFF', mode: 'light' },
    { name: 'Ciepły piasek', value: '#FDFCF0', mode: 'light' },
    { name: 'Systemowy', value: 'system', mode: 'system' },
  ];

  const brandOptions = [
    { name: 'Klasyczny bursztyn', value: '#F5A623' },
    { name: 'Neonowy turkus', value: '#00F5FF' },
    { name: 'Elektryczny fiolet', value: '#A020F0' },
    { name: 'Szmaragd', value: '#10B981' },
    { name: 'Karmazyn', value: '#EF4444' },
  ];

  const handleModeChange = (bgValue: string, mode: string) => {
    let surface = '#141414';
    let border = '#222222';
    let text = '#FFFFFF';
    let textMuted = '#9CA3AF';

    if (mode === 'light') {
      surface = bgValue === '#FFFFFF' ? '#F9FAFB' : '#F5F5F0';
      border = '#E5E7EB';
      text = '#0F172A';
      textMuted = '#4B5563';
    } else if (mode === 'dark') {
      surface = bgValue === '#000000' ? '#0A0A0A' : '#1E293B';
      border = bgValue === '#000000' ? '#1A1A1A' : '#334155';
    } else if (mode === 'system') {
      const updates = { 
        theme_bg: 'system', 
        theme_mode: 'system',
        theme_surface: '',
        theme_border: '',
        theme_text: '',
        theme_text_muted: ''
      };
      setLocalSettings({ ...localSettings, ...updates });
      saveMutation.mutate(updates);
      return;
    }

    const updates = { 
      theme_bg: bgValue, 
      theme_mode: mode,
      theme_surface: surface,
      theme_border: border,
      theme_text: text,
      theme_text_muted: textMuted
    };

    setLocalSettings({ ...localSettings, ...updates });
    saveMutation.mutate(updates);
  };

  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto space-y-10 pb-20 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-bold text-text tracking-tighter">Ustawienia</h1>
          <p className="text-text-muted text-sm font-medium">Personalizacja Twojej instancji OLX Tracker Pro</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Wygląd */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="p-2 bg-brand/10 rounded-lg text-brand">
              <Palette size={20} />
            </div>
            <h2 className="text-xl font-bold text-text uppercase tracking-tight">Motyw i Wygląd</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 card p-8 glass-enabled">
            <div className="space-y-4">
              <label className="text-xs font-mono text-text-muted uppercase tracking-widest font-bold flex items-center gap-2">
                <Layout size={14} className="text-brand" /> Kolor tła
              </label>
              <div className="grid grid-cols-2 gap-3">
                {bgOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleModeChange(opt.value, opt.mode)}
                    className={cn(
                      "p-3 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center gap-2",
                      localSettings.theme_bg === opt.value 
                      ? "border-brand bg-brand/10 text-brand shadow-[0_0_15px_rgba(var(--color-brand-rgb),0.1)]" 
                      : "border-border bg-bg/50 text-text-muted hover:border-text-muted/50"
                    )}
                  >
                    {opt.value === 'system' ? (
                      <Monitor size={12} className="shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full shadow-inner border border-gray-700/50" style={{ backgroundColor: opt.value }} />
                    )}
                    {opt.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-mono text-text-muted uppercase tracking-widest font-bold flex items-center gap-2">
                <Palette size={14} className="text-brand" /> Kolor akcentu
              </label>
              <div className="flex flex-wrap gap-3">
                {brandOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleChange('theme_primary', opt.value)}
                    style={{ 
                      backgroundColor: localSettings.theme_primary === opt.value ? opt.value : 'transparent',
                      borderColor: opt.value
                    }}
                    className={cn(
                      "w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center",
                      localSettings.theme_primary === opt.value ? "shadow-[0_0_15px_rgba(255,255,255,0.2)]" : "hover:scale-110"
                    )}
                    title={opt.name}
                  >
                    {localSettings.theme_primary === opt.value && <div className="w-2 h-2 bg-text rounded-full" />}
                  </button>
                ))}
                
                <div className="relative group">
                  <input 
                    type="color" 
                    value={localSettings.theme_primary} 
                    onChange={e => handleChange('theme_primary', e.target.value)}
                    className="w-10 h-10 rounded-full border-none bg-transparent cursor-pointer absolute inset-0 opacity-0 z-10"
                  />
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center text-text-muted group-hover:border-brand/50 group-hover:text-brand transition-all">
                    <Save size={16} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-2 space-y-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-text">Przezroczystość (Glassmorphism)</p>
                  <p className="text-xs text-text-muted">Dodaje efekt rozmytego szkła do paneli</p>
                </div>
                <button 
                  onClick={() => handleChange('glass_morphism', localSettings.glass_morphism === 'true' ? 'false' : 'true')}
                  className={cn(
                    "w-14 h-7 rounded-full transition-colors relative flex items-center px-1 shrink-0",
                    localSettings.glass_morphism === 'true' ? "bg-brand" : "bg-gray-800"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 bg-white rounded-full transition-transform shadow-md",
                    localSettings.glass_morphism === 'true' ? "translate-x-7" : "translate-x-0"
                  )} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Monitoring */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Gauge size={20} />
            </div>
            <h2 className="text-xl font-bold text-text uppercase tracking-tight">Automatyzacja</h2>
          </div>

          <div className="card p-8 glass-enabled space-y-8">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-text">Automatyczne odświeżanie i weryfikacja</p>
                <p className="text-xs text-text-muted">System sam sprawdza dostępność i zbiera nowe dane co 12 godzin</p>
              </div>
                <button 
                  disabled={saveMutation.isPending}
                  onClick={() => handleChange('auto_check_enabled', localSettings.auto_check_enabled === 'true' ? 'false' : 'true')}
                  className={cn(
                    "w-14 h-7 rounded-full transition-colors relative flex items-center px-1 shrink-0",
                    localSettings.auto_check_enabled === 'true' ? "bg-brand" : "bg-gray-800",
                    saveMutation.isPending && "opacity-50 cursor-wait"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 bg-white rounded-full transition-transform",
                    localSettings.auto_check_enabled === 'true' ? "translate-x-7" : "translate-x-0"
                  )} />
                </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
