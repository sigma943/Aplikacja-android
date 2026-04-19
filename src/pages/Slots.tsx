import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Trash2, Power, ExternalLink, Link as LinkIcon, Settings2, X, RefreshCw, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function Slots() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [newSlot, setNewSlot] = useState({ name: '', url: '', max_offers: 50, exclude_words: '' });

  const { data: slots } = useQuery({
    queryKey: ['slots'],
    queryFn: async () => (await axios.get('/api/slots')).data,
    refetchInterval: 5000, // Update status every 5s
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => await axios.post('/api/slots', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      setIsModalOpen(false);
      setNewSlot({ name: '', url: '', max_offers: 50, exclude_words: '' });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => await axios.patch(`/api/slots/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      setIsModalOpen(false);
      setEditingSlotId(null);
      setNewSlot({ name: '', url: '', max_offers: 50, exclude_words: '' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => await axios.patch(`/api/slots/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['slots'] }),
  });

  const stopMutation = useMutation({
    mutationFn: async (id?: number) => await axios.post('/api/run/collect/stop', { slot_id: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['logs'] }), 1000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['slots'] }), 2500);
    },
  });

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => await axios.delete(`/api/slots/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      setDeletingId(null);
    },
    onError: (error) => {
      console.error('Delete error:', error);
      alert('Błąd podczas usuwania slotu. Spróbuj ponownie.');
      setDeletingId(null);
    }
  });

  const runMutation = useMutation({
    mutationFn: async (id: number) => await axios.post('/api/run/collect', { slot_id: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['logs'] }), 1000);
    },
  });

  const openAddModal = () => {
    setEditingSlotId(null);
    setNewSlot({ name: '', url: '', max_offers: 50, exclude_words: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (slot: any) => {
    setEditingSlotId(slot.id);
    setNewSlot({ 
      name: slot.name, 
      url: slot.url, 
      max_offers: slot.max_offers, 
      exclude_words: slot.exclude_words || '' 
    });
    setIsModalOpen(true);
  };

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tighter">Konfiguracja Slotów</h1>
          <p className="text-gray-500 text-sm font-medium">Zarządzaj aktywnymi procesami monitorowania rynku.</p>
        </div>
        
        <button 
          onClick={openAddModal}
          className="btn-primary flex items-center gap-2 px-6 py-3 w-full md:w-auto justify-center text-sm font-bold"
        >
          <Plus size={20} />
          Dodaj nowy slot
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {slots?.map((slot: any, i: number) => (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            key={slot.id} 
            className={cn(
              "card p-6 flex flex-col gap-4",
              !slot.active && "opacity-50 grayscale"
            )}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white truncate max-w-[200px]">{slot.name}</h3>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    slot.is_running ? "bg-brand animate-pulse" : (slot.active ? "bg-green-500" : "bg-gray-600")
                  )} />
                  <span className="text-[10px] font-mono text-gray-500 uppercase font-bold">
                    {slot.is_running ? 'Pracuje' : (slot.active ? 'Gotowy' : 'Wstrzymany')}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => openEditModal(slot)}
                  className="p-2 rounded-lg border border-border text-gray-500 hover:text-brand hover:border-brand/40 transition-colors"
                  title="Edytuj slot"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(slot.id); }}
                  className={cn(
                    "p-2 rounded-lg border transition-colors",
                    slot.active ? "border-brand/40 text-brand bg-brand/5" : "border-border text-gray-500"
                  )}
                >
                  <Power size={18} />
                </button>
              </div>
            </div>

            <div className="bg-bg/50 p-2 rounded border border-border flex items-center justify-between gap-2 overflow-hidden">
              <span className="text-[10px] font-mono text-gray-500 truncate">{slot.url}</span>
              <a href={slot.url} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-brand transition-colors shrink-0">
                <ExternalLink size={14} />
              </a>
            </div>

            <div className="flex justify-between items-end mt-auto pt-4 border-t border-border">
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 uppercase font-bold">Pojemność</p>
                <p className="text-sm font-bold text-white">{slot.max_offers} <span className="text-[10px] text-gray-500 font-normal">ofert</span></p>
              </div>

              <div className="flex items-center gap-2">
                {slot.is_running ? (
                  <button 
                    onClick={() => stopMutation.mutate(slot.id)}
                    className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-[10px] font-bold uppercase hover:bg-red-500 hover:text-white transition-all"
                  >
                    STOP
                  </button>
                ) : (
                  <button 
                    onClick={() => runMutation.mutate(slot.id)}
                    disabled={!slot.active}
                    className="btn-primary py-1.5 px-4 text-[10px] uppercase tracking-wider"
                  >
                    SKANUJ
                  </button>
                )}
                
                <button onClick={() => deleteMutation.mutate(slot.id)} className="p-1.5 text-gray-600 hover:text-red-500 rounded">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        
        {slots?.length === 0 && (
          <div className="col-span-full card py-24 flex flex-col items-center justify-center text-center space-y-6 border-dashed border-2 border-border/40 bg-transparent">
            <div className="relative">
              <div className="absolute inset-0 bg-brand/20 blur-2xl rounded-full" />
              <div className="relative p-8 rounded-full bg-surface border border-border/50 text-gray-700">
                <LinkIcon size={48} />
              </div>
            </div>
            <div className="max-w-xs space-y-2">
              <h3 className="text-xl font-bold text-white">Bazy danych są puste</h3>
              <p className="text-gray-500 text-sm leading-relaxed">System potrzebuje co najmniej jednego aktywnego slotu, aby rozpocząć monitorowanie rynku.</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card w-full max-w-md relative z-10 p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-white">
                  {editingSlotId ? 'Edytuj slot' : 'Nowy slot'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Nazwa slotu</label>
                  <input 
                    type="text" 
                    placeholder="np. iPhone 15 Pro - Warszawa"
                    value={newSlot.name}
                    onChange={e => setNewSlot({...newSlot, name: e.target.value})}
                    className="input-field w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">URL z OLX</label>
                  <input 
                    type="url" 
                    placeholder="https://www.olx.pl/elektronika/telefony/..."
                    value={newSlot.url}
                    onChange={e => setNewSlot({...newSlot, url: e.target.value})}
                    className="input-field w-full"
                  />
                  <p className="text-[10px] text-gray-500 leading-relaxed italic">
                    Wskazówka: Ustaw filtry (cena, stan, miasto) na OLX i wklej gotowy link. System go uszanuje.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex justify-between">
                    Limit ofert <span>{newSlot.max_offers}</span>
                  </label>
                  <input 
                    type="range" 
                    min="10" max="500" step="10"
                    value={newSlot.max_offers}
                    onChange={e => setNewSlot({...newSlot, max_offers: parseInt(e.target.value)})}
                    className="w-full accent-brand bg-surface h-2 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div className="space-y-2 mt-4 pt-4 border-t border-border/50">
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Wykluczone słowa (opcjonalnie)</label>
                  <input 
                    type="text" 
                    placeholder="np. etui, uszkodzony, plecki"
                    value={newSlot.exclude_words}
                    onChange={e => setNewSlot({...newSlot, exclude_words: e.target.value})}
                    className="input-field w-full"
                  />
                  <p className="text-[10px] text-gray-500 leading-relaxed italic">
                    Podaj słowa po przecinku. Oferty zawierające te słowa w tytule lub parametrach zostaną zignorowane.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-10">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary flex-1"
                >
                  Anuluj
                </button>
                <button 
                  onClick={() => {
                    if (editingSlotId) {
                      editMutation.mutate({ id: editingSlotId, data: newSlot });
                    } else {
                      addMutation.mutate(newSlot);
                    }
                  }}
                  disabled={!newSlot.name || !newSlot.url || addMutation.isPending || editMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {(addMutation.isPending || editMutation.isPending) ? (
                    <RefreshCw size={18} className="animate-spin mx-auto" />
                  ) : 'Zapisz slot'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

