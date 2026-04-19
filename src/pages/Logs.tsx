import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { FileText, AlertCircle, CheckCircle2, Clock, Trash2, X, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, parseDbDate } from '../lib/utils';
import { useState } from 'react';

export default function Logs() {
  const queryClient = useQueryClient();
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: async () => (await axios.get('/api/logs')).data,
    refetchInterval: (query: any) => {
      const logsData = query.state.data;
      return Array.isArray(logsData) && logsData.some((l: any) => !l.finished_at) ? 1500 : 10000;
    },
  });

  const { data: status } = useQuery({
    queryKey: ['run-status'],
    queryFn: async () => (await axios.get('/api/run/status')).data,
    refetchInterval: (query: any) => {
      const statusData = query.state.data;
      return (statusData?.isChecking || statusData?.isCollecting) ? 1500 : 5000;
    },
  });

  const stopCheckMutation = useMutation({
    mutationFn: async () => await axios.post('/api/run/check/stop'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['run-status'] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['logs'] }), 1000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['logs'] }), 2500);
    },
  });

  const stopCollectMutation = useMutation({
    mutationFn: async (vars?: { slot_id?: number }) => await axios.post('/api/run/collect/stop', vars || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['run-status'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['logs'] }), 1000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['logs'] }), 2500);
    },
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => await axios.delete('/api/logs'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      setIsConfirmingClear(false);
    },
  });

  const { data: slots } = useQuery({
    queryKey: ['slots'],
    queryFn: async () => (await axios.get('/api/slots')).data,
  });

  const getSlotName = (id: number) => {
    if (!id) return 'Wszystkie sloty';
    return slots?.find((s: any) => s.id === id)?.name || `Slot #${id}`;
  };

  return (
    <div className="p-4 md:p-10 max-w-5xl mx-auto space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tighter">Logi Systemowe</h1>
          <p className="text-gray-500 text-sm font-medium">Historia wykonanych operacji i komunikatów.</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {status?.isChecking && (
            <button
              onClick={() => stopCheckMutation.mutate()}
              className="flex items-center gap-2 bg-blue-500/10 text-blue-500 px-4 py-2.5 rounded-xl border border-blue-500/20 text-[10px] font-bold uppercase transition-all hover:bg-red-500 hover:text-white hover:border-red-500 group"
            >
              <RefreshCw size={14} className="animate-spin group-hover:hidden" />
              <div className="w-3.5 h-3.5 hidden group-hover:block border-2 border-current" />
              Weryfikacja bazy
            </button>
          )}

          {status?.isCollecting && (
            <button
              onClick={() => stopCollectMutation.mutate({})}
              className="flex items-center gap-2 bg-brand/10 text-brand px-4 py-2.5 rounded-xl border border-brand/20 text-[10px] font-bold uppercase transition-all hover:bg-red-500 hover:text-white hover:border-red-500 group"
            >
              <RefreshCw size={14} className="animate-spin group-hover:hidden" />
              <div className="w-3.5 h-3.5 hidden group-hover:block border-2 border-current" />
              Pobór ofert
            </button>
          )}

          {logs && logs.length > 0 && (
            <div className="flex items-center gap-2">
              {isConfirmingClear ? (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-1 justify-between min-w-[200px]">
                  <button
                    onClick={() => clearLogsMutation.mutate()}
                    className="px-4 py-2 bg-red-500 text-white text-[10px] font-bold rounded-lg hover:bg-red-600 transition-all uppercase tracking-widest"
                  >
                    Usuń historię
                  </button>
                  <button
                    onClick={() => setIsConfirmingClear(false)}
                    className="p-2 text-gray-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsConfirmingClear(true)}
                  className="btn-secondary flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-4 py-2.5"
                >
                  <Trash2 size={16} />
                  Wyczyść logi
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-20 animate-pulse bg-surface-hover/20" />
          ))
        ) : (
          logs?.map((log: any, i: number) => {
            const duration = log.finished_at 
              ? Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)
              : null;
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                key={log.id} 
                className="card p-4 flex flex-col md:flex-row gap-4 md:items-center hover:bg-surface-hover/50 transition-colors"
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  log.errors > 0 ? "bg-red-500/10 text-red-500" : (log.finished_at ? "bg-green-500/10 text-green-500" : "bg-brand/10 text-brand")
                )}>
                  {log.errors > 0 ? <AlertCircle size={20} /> : (log.finished_at ? <CheckCircle2 size={20} /> : <Clock size={20} className="animate-spin" />)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      log.run_type.includes('collect') ? "text-brand" : "text-blue-500"
                    )}>
                      {log.run_type.includes('collect') ? 'Pobór ogłoszeń' : 'Weryfikacja bazy'}
                    </span>
                    {log.run_type.includes('stopped') && (
                      <span className="text-[10px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Przerwano</span>
                    )}
                    <span className="text-[10px] text-gray-600 font-mono">#{log.id}</span>
                  </div>
                  <p className="text-sm font-semibold text-white truncate">
                    {getSlotName(log.slot_id)}
                  </p>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                  <div className="flex flex-wrap items-center gap-6 text-xs text-gray-400">
                    <div className="space-y-0.5">
                      <p className="text-[9px] uppercase text-gray-600 font-bold">Godzina</p>
                      <p className="font-mono">{format(parseDbDate(log.started_at), 'HH:mm:ss')}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] uppercase text-gray-600 font-bold">Wynik</p>
                      {log.run_type.includes('collect') ? (
                        <p className="font-bold text-gray-300">+{log.new_offers} nowych</p>
                      ) : (
                        <p className="font-bold text-gray-300">{log.sold_found} sprz. / {log.price_drops} obn.</p>
                      )}
                    </div>
                    {log.errors > 0 && (
                      <div className="bg-red-500/10 text-red-500 px-2 py-1 rounded border border-red-500/20 text-[10px] font-bold uppercase">
                        Błędy: {log.errors}
                      </div>
                    )}
                  </div>

                  {!log.finished_at && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (log.run_type.includes('collect')) stopCollectMutation.mutate({ slot_id: log.slot_id });
                        else stopCheckMutation.mutate();
                      }}
                      className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg border border-red-500/20 transition-all text-[11px] font-bold uppercase tracking-widest"
                      title="Zatrzymaj teraz"
                    >
                      <X size={14} />
                      Zatrzymaj zadanie
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}

        {!isLoading && logs?.length === 0 && (
          <div className="card py-24 flex flex-col items-center justify-center text-center space-y-4 border-dashed bg-transparent border-2 border-border/40">
            <div className="p-6 rounded-full bg-surface border border-border/50 text-gray-700">
              <FileText size={48} />
            </div>
            <div className="max-w-xs space-y-1">
              <h3 className="text-lg font-bold text-white leading-tight">Historia jest czysta</h3>
              <p className="text-gray-500 text-sm">System nie zarejestrował jeszcze żadnych aktywności skanowania.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
