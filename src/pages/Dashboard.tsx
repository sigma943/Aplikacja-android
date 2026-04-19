import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Play, RefreshCw, Clock, AlertCircle, TrendingDown, Package, CheckCircle2, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { cn, parseDbDate } from '../lib/utils';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await axios.get('/api/settings')).data,
    staleTime: Infinity
  });

  const refreshInterval = settings?.refresh_interval_stats ? parseInt(settings.refresh_interval_stats) : 30000;

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await axios.get('/api/stats')).data,
    refetchInterval: refreshInterval,
  });

  const { data: scheduler } = useQuery({
    queryKey: ['scheduler-status'],
    queryFn: async () => (await axios.get('/api/scheduler/status')).data,
    refetchInterval: 5000,
  });

  const { data: priceDrops } = useQuery({
    queryKey: ['price-drops'],
    queryFn: async () => (await axios.get('/api/stats/price-drops')).data,
    refetchInterval: refreshInterval,
  });

  const { data: logs } = useQuery({
    queryKey: ['logs'],
    queryFn: async () => (await axios.get('/api/logs')).data,
    refetchInterval: 5000,
  });

  const collectMutation = useMutation({
    mutationFn: async () => await axios.post('/api/run/collect', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['logs'] }), 1000);
    },
  });

  const checkMutation = useMutation({
    mutationFn: async () => await axios.post('/api/run/check', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['price-drops'] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['logs'] }), 1000);
    },
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => await axios.delete('/api/logs'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });

  const nextRun = scheduler?.nextRunTime ? new Date(scheduler.nextRunTime) : null;
  const timeToNext = nextRun ? Math.max(0, Math.floor((nextRun.getTime() - Date.now()) / 60000)) : 0;
  const hours = Math.floor(timeToNext / 60);
  const mins = timeToNext % 60;

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-bold text-text tracking-tighter">Panel Sterowania</h1>
          <p className="text-text-muted text-sm font-medium">Monitoring rynku w czasie rzeczywistym</p>
          
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-[11px] font-mono text-text-muted uppercase tracking-widest">
              <Clock size={14} className="text-brand" />
              Następna sesja: <span className="text-text font-bold">{hours}h {mins}m</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-[11px] font-mono text-text-muted uppercase tracking-widest">
              <div className={cn("w-2 h-2 rounded-full", scheduler?.isRunning ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse" : "bg-gray-600")} />
              Status systemu: <span className={cn("font-bold", scheduler?.isRunning ? "text-green-500" : "text-text")}>{scheduler?.isRunning ? 'AKTYWNY' : 'OCZEKIWANIE'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => collectMutation.mutate()}
            disabled={collectMutation.isPending || scheduler?.isRunning}
            className="btn-primary flex-1 md:flex-none flex items-center justify-center gap-2 h-11 px-6 text-sm"
          >
            <Play size={18} className={cn(collectMutation.isPending && "animate-spin")} />
            Uruchom Skaner
          </button>
          <button 
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending || scheduler?.isRunning}
            className="btn-secondary flex-1 md:flex-none flex items-center justify-center gap-2 h-11 px-6 text-sm"
          >
            <RefreshCw size={18} className={cn(checkMutation.isPending && "animate-spin")} />
            Weryfikacja
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Aktywne ogłoszenia', value: stats?.activeOffers || 0, icon: Package, color: 'text-brand', bg: 'bg-brand/10' },
          { label: 'Sprzedane / Usunięte', value: stats?.archivedOffers || 0, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Obniżki cen', value: stats?.priceDrops || 0, icon: TrendingDown, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Błędy systemu', value: stats?.errors || 0, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={stat.label} 
            className="card p-6"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-3xl font-bold text-text font-mono">{stat.value}</h3>
              </div>
              <div className={cn("p-3 rounded-xl", stat.bg, stat.color)}>
                <stat.icon size={24} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-xl font-bold text-text flex items-center gap-2">
              <TrendingDown size={20} className="text-brand" />
              Ostatnie obniżki cen
            </h2>
          </div>

          <div className="space-y-3">
            {priceDrops && priceDrops.length > 0 ? (
              priceDrops.slice(0, 5).map((drop: any, i: number) => {
                const dropPct = Math.round(((drop.initial_price - drop.current_price) / drop.initial_price) * 100);
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={drop.id} 
                    className="card p-3 flex items-center gap-4 hover:bg-surface-hover/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/offers?select=${drop.id}`)}
                  >
                    <div className="w-16 h-16 rounded-lg bg-bg border border-border overflow-hidden shrink-0">
                      {drop.images_dir ? (
                        <img 
                          src={`${drop.images_dir}/0.jpg`} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          alt="" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-muted">
                          <Package size={24} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-text truncate group-hover:text-brand transition-colors">{drop.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-lg font-bold text-brand font-mono">{drop.current_price} zł</span>
                        <span className="text-xs text-text-muted line-through font-mono">{drop.initial_price} zł</span>
                        <span className="px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-500 rounded">-{dropPct}%</span>
                      </div>
                    </div>
                    
                    <div className="hidden sm:block text-right pr-4">
                      <p className="text-[10px] text-text-muted font-mono uppercase">{parseDbDate(drop.dropped_at).toLocaleDateString('pl-PL')}</p>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="py-12 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center text-text-muted/50">
                <TrendingDown size={40} strokeWidth={1} className="mb-2 opacity-20" />
                <p className="text-sm">Brak nowych obniżek cen w bazie.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-xl font-bold text-text flex items-center gap-2">
              <History size={20} className="text-blue-500" />
              Ostatnia aktywność
            </h2>
            <button 
              onClick={() => clearLogsMutation.mutate()}
              className="px-3 py-1 bg-surface border border-border rounded text-[10px] font-bold text-text-muted hover:text-red-400 hover:border-red-400 transition-colors uppercase tracking-widest"
            >
              Wyczyść
            </button>
          </div>

          <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-border">
            {logs?.slice(0, 6).map((log: any, i: number) => (
              <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={log.id} 
                className="relative ml-8 group"
              >
                <div className={cn(
                  "absolute -left-[25px] top-1.5 w-2 h-2 rounded-full border border-bg z-10",
                  log.run_type === 'collect' ? "bg-brand" : "bg-blue-500"
                )} />

                <div className="flex justify-between items-center mb-1">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    log.run_type === 'collect' ? "text-brand" : "text-blue-500"
                  )}>
                    {log.run_type === 'collect' ? 'Pobór' : 'Weryfikacja'}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">
                    {parseDbDate(log.started_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <p className="text-xs text-text-muted font-medium">
                  {log.run_type === 'collect' 
                    ? `Dodano ${log.new_offers} nowych ogłoszeń.` 
                    : `Znaleziono ${log.sold_found} sprzedanych i ${log.price_drops} obniżek.`}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
