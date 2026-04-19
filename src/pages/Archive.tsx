import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { MapPin, Calendar, Clock, Download, ChevronLeft, ChevronRight, Search, Archive, Image as ImageIcon, Info, FileText, ExternalLink, TrendingDown, X, DollarSign, Trash2, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, parseDbDate } from '../lib/utils';

export default function ArchivePage() {
  const [selectedSlot, setSelectedSlot] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<number | null>(null);
  const [isConfirmingModalDelete, setIsConfirmingModalDelete] = useState(false);
  
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => axios.delete(`/api/offers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['archive-stats'] });
      setOfferToDelete(null);
      if (selectedOffer) setSelectedOffer(null);
    }
  });

  const clearMutation = useMutation({
    mutationFn: () => axios.delete('/api/archive/clear'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['archive-stats'] });
    }
  });

  const { data: slots } = useQuery({
    queryKey: ['slots'],
    queryFn: async () => (await axios.get('/api/slots')).data,
  });

  const queryParams = new URLSearchParams({ 
    status: 'sold_or_removed',
    page: page.toString(),
    limit: '24'
  });
  if (selectedSlot) queryParams.append('slot_id', selectedSlot);
  if (search) queryParams.append('search', search);

  const { data: response, isLoading } = useQuery({
    queryKey: ['offers', 'sold_or_removed', selectedSlot, search, page],
    queryFn: async () => (await axios.get(`/api/offers?${queryParams.toString()}`)),
  });

  const offers = response?.data?.offers || [];
  const pagination = response?.data?.pagination;

  const { data: priceHistory } = useQuery({
    queryKey: ['price-history', selectedOffer?.id],
    queryFn: async () => (await axios.get(`/api/offers/${selectedOffer.id}/price-history`)).data,
    enabled: !!selectedOffer,
  });

  const { data: stats } = useQuery({
    queryKey: ['archive-stats', selectedSlot],
    queryFn: async () => (await axios.get(`/api/archive/stats${selectedSlot ? `?slot_id=${selectedSlot}` : ''}`)).data,
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-6 md:space-y-10 relative">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-5xl font-bold text-text tracking-tighter">Archiwum Ogłoszeń</h1>
            <p className="text-text-muted text-sm font-medium">Przeglądaj historię sprzedanych i usuniętych ofert.</p>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <select 
              value={selectedSlot} 
              onChange={e => { setSelectedSlot(e.target.value); setPage(1); }}
              className="px-4 py-2 bg-surface border border-border rounded-lg text-xs font-mono text-gray-400 focus:border-brand/50 outline-none transition-all w-full md:w-64"
            >
              <option value="">Wszystkie operacje</option>
              {slots?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <a 
                href={`/api/export/csv?status=sold_or_removed${selectedSlot ? `&slot_id=${selectedSlot}` : ''}`}
                className="flex items-center gap-2 px-4 py-2 bg-brand/5 border border-brand/20 rounded-lg text-[10px] font-bold text-brand uppercase tracking-widest hover:bg-brand/10 transition-all"
              >
                <Download size={12} /> Export CSV
              </a>
              {pagination && pagination.total > 0 && (
                <button 
                  onClick={() => clearMutation.mutate()}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] font-bold text-red-500 uppercase tracking-widest hover:bg-red-500/20 transition-all shadow-sm"
                >
                  <Trash2 size={12} /> Usuń wszystko
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-brand transition-colors" size={16} />
          <input 
            type="text"
            placeholder="Filtruj bazę historyczną (marka, model, słowa kluczowe)..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-surface/30 border border-border/50 rounded-xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-brand/40 focus:bg-surface/50 transition-all placeholder:text-gray-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 bg-surface/20 border border-border/10 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : offers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offers.map((offer: any, i: number) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (i % 8) * 0.05 }}
                  key={offer.id} 
                  onClick={() => setSelectedOffer(offer)}
                  className="group relative bg-surface/20 border border-border/50 rounded-2xl overflow-hidden hover:border-brand/30 transition-all cursor-pointer"
                >
                  <div className="flex gap-4 p-4">
                    <div className="w-24 h-24 rounded-xl bg-bg border border-border overflow-hidden shrink-0 relative">
                      {offer.images_count > 0 ? (
                        <>
                          <img 
                            src={`${offer.images_dir}/0.jpg`} 
                            className="w-full h-full object-cover grayscale-[50%] group-hover:grayscale-0 transition-all duration-500 scale-105 group-hover:scale-100" 
                            alt="" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-800">
                          <ImageIcon size={24} />
                        </div>
                      )}
                      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 rounded font-mono text-[8px] text-gray-400 border border-white/5">
                        {offer.images_count} FOT
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col pt-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[8px] font-mono text-gray-600 uppercase tracking-widest truncate max-w-[100px]">
                          {offer.slot_name || 'Systemowy'}
                        </span>
                        <span className="text-[9px] font-mono text-gray-500 italic">
                          {format(parseDbDate(offer.sold_detected_at || offer.updated_at), 'dd.MM', { locale: pl })}
                        </span>
                      </div>
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <h3 className="text-sm font-bold text-text line-clamp-2 leading-snug group-hover:text-brand transition-colors flex-1">
                          {offer.title}
                        </h3>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteMutation.mutate(offer.id);
                          }}
                          className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-bg rounded-lg transition-all z-30 shrink-0"
                          title="Usuń ogłoszenie"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="mt-auto flex items-end justify-between">
                        <div className="text-lg font-black font-mono text-text-muted group-hover:text-brand transition-colors">
                          {offer.price ? `${offer.price} zł` : '—'}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-text-muted font-mono opacity-60">
                          <Clock size={10} />
                          {offer.lifetime_days?.toFixed(0) || '?'} dni
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="h-1 w-full bg-border/20 group-hover:bg-brand/20 transition-colors" />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-32 flex flex-col items-center justify-center text-center opacity-30 grayscale">
              <Archive size={64} strokeWidth={1} className="mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tighter">Baza danych pusta</h3>
              <p className="text-sm font-mono mt-2">Brak zarejestrowanych transakcji dla zadanych filtrów.</p>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-10">
              <button 
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="p-3 bg-surface border border-border rounded-xl text-gray-500 hover:text-text hover:border-brand/40 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="px-6 py-3 bg-surface/50 border border-border rounded-xl font-mono text-xs">
                <span className="text-gray-500">DATA_BLOCK </span>
                <span className="text-brand font-bold">{page}</span>
                <span className="text-gray-600 px-2">/</span>
                <span className="text-text">{pagination.pages}</span>
              </div>
              <button 
                onClick={() => handlePageChange(page + 1)}
                disabled={page === pagination.pages}
                className="p-3 bg-surface border border-border rounded-xl text-gray-500 hover:text-text hover:border-brand/40 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface/30 border border-border/50 rounded-2xl p-6 space-y-8">
            <h2 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] border-b border-border/50 pb-4">
              Analiza Historyczna
            </h2>

            <div className="space-y-6">
              <div className="relative">
                <p className="text-[9px] font-mono text-text-muted uppercase mb-1">Średnia Kwota</p>
                <p className="text-3xl font-black text-text font-mono tracking-tighter">
                  {stats?.avgPrice ? `${Math.round(stats.avgPrice).toLocaleString('pl-PL')} zł` : '—'}
                </p>
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand/30 rounded-r" />
              </div>

              <div className="relative">
                <p className="text-[9px] font-mono text-text-muted uppercase mb-1">Średni Czas Sprzedania</p>
                <p className="text-3xl font-black text-text font-mono tracking-tighter">
                  {stats?.avgLifetime ? `${stats.avgLifetime.toFixed(1)} dni` : '—'}
                </p>
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500/30 rounded-r" />
              </div>
            </div>

            <div className="pt-8 border-t border-border/50">
              <h3 className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-4">Najczęstsze Lokalizacje</h3>
              <div className="space-y-3">
                {stats?.cities?.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs transition-colors hover:text-brand">
                    <span className="text-gray-500 truncate mr-4">{c.city || 'Global'}</span>
                    <span className="font-mono bg-white/5 px-2 py-0.5 rounded text-[10px] text-gray-400 border border-white/5">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modal Detail */}
      <AnimatePresence>
        {selectedOffer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOffer(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              layoutId={`card-${selectedOffer.id}`}
              className="card bg-bg border border-border w-full max-w-6xl max-h-[95vh] sm:rounded-3xl overflow-y-auto shadow-2xl relative z-10 flex flex-col md:flex-row"
            >
              <button 
                onClick={() => setSelectedOffer(null)}
                className="absolute top-6 right-6 z-50 bg-bg p-3 rounded-full text-text border border-border hover:bg-surface transition-all cursor-pointer"
              >
                <X size={20} />
              </button>

              {/* Photo Section */}
              <div className="md:w-1/2 h-80 md:h-auto bg-black/5 flex flex-col items-center justify-center p-6 border-r border-border min-h-[400px]">
                <div className="flex-1 relative group overflow-hidden bg-bg rounded-2xl border border-border w-full flex items-center justify-center">
                  {selectedOffer.images_count > 0 ? (
                    <img 
                      src={`${selectedOffer.images_dir}/${activeImageIndex}.jpg`} 
                      className="w-full h-full object-contain" 
                      alt="" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted opacity-20">
                      <ImageIcon size={100} strokeWidth={1} />
                    </div>
                  )}
                </div>
                
                {selectedOffer.images_count > 1 && (
                  <div className="mt-4 w-full grid grid-cols-6 gap-2">
                    {Array.from({ length: Math.min(12, selectedOffer.images_count) }).map((_, i) => (
                      <div 
                        key={i} 
                        onClick={() => setActiveImageIndex(i)}
                        className={cn(
                          "aspect-square rounded-lg border overflow-hidden cursor-pointer transition-all p-1",
                          activeImageIndex === i ? "border-brand border-2 bg-brand/5" : "border-border/50 opacity-40 hover:opacity-100"
                        )}
                      >
                        <img 
                          src={`${selectedOffer.images_dir}/${i}.jpg`} 
                          className="w-full h-full object-cover rounded" 
                          alt="" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Data Section */}
              <div className="md:w-1/2 p-8 md:p-12 space-y-10">
                <div className="space-y-4 pr-10">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-text-muted/10 text-text-muted text-[10px] font-black uppercase tracking-widest border border-border rounded">ZARCHIWIZOWANE</span>
                    <span className="text-[10px] font-mono text-text-muted opacity-60">ID: {selectedOffer.offer_id}</span>
                  </div>
                  <h2 className="text-3xl font-black text-text tracking-tight leading-tight">
                    {selectedOffer.title}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-surface/50 border border-border rounded-2xl relative overflow-hidden group">
                    <p className="text-[10px] font-mono text-text-muted uppercase mb-1 tracking-widest">Cena końcowa</p>
                    <p className="text-3xl font-black text-brand font-mono tracking-tighter">
                      {selectedOffer.price ? `${selectedOffer.price} zł` : '—'}
                    </p>
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-brand group-hover:scale-110 transition-transform">
                      <DollarSign size={48} />
                    </div>
                  </div>
                  <div className="p-6 border border-border rounded-2xl flex flex-col justify-center">
                    <p className="text-[10px] font-mono text-text-muted uppercase mb-1 tracking-widest">Status transakcji</p>
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                       <Archive size={12} className="text-brand" /> ZAKOŃCZONO
                    </p>
                  </div>
                </div>

                {priceHistory && priceHistory.length > 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                       <TrendingDown size={14} className="text-brand" />
                       <h4 className="text-[11px] font-black text-text uppercase tracking-widest">Wykres dewaluacji</h4>
                    </div>
                    <div className="h-44 w-full bg-surface/30 rounded-2xl p-6 border border-border">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={priceHistory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                          <XAxis dataKey="checked_at" hide />
                          <YAxis domain={['auto', 'auto']} hide />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'var(--color-surface)', 
                              border: '1px solid var(--color-border)', 
                              borderRadius: '12px',
                              color: 'var(--color-text)'
                            }}
                            itemStyle={{ color: 'var(--color-text)' }}
                            labelStyle={{ color: 'var(--color-text-muted)' }}
                            labelFormatter={(val) => format(parseDbDate(val), 'dd.MM.yyyy HH:mm', { locale: pl })}
                          />
                          <Line 
                            type="stepAfter" 
                            dataKey="price" 
                            stroke="var(--color-brand)" 
                            strokeWidth={4} 
                            dot={{ r: 4, fill: 'var(--color-bg)', stroke: 'var(--color-brand)', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: 'var(--color-brand)' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div className="space-y-10">
                  <div className="grid grid-cols-2 gap-8 py-8 border-y border-border">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                        <MapPin size={10} className="text-brand" /> Lokalizacja
                      </p>
                      <p className="text-sm text-text font-bold">{selectedOffer.city}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar size={10} className="text-brand" /> Wykryto sprzedaż
                      </p>
                      <p className="text-sm text-text font-bold">
                        {format(parseDbDate(selectedOffer.sold_detected_at || selectedOffer.updated_at), 'dd MMMM yyyy', { locale: pl })}
                      </p>
                    </div>
                  </div>

                  {selectedOffer.parameters && (() => {
                    try {
                      const paramsList = typeof selectedOffer.parameters === 'string' ? JSON.parse(selectedOffer.parameters) : selectedOffer.parameters;
                      if (!Array.isArray(paramsList) || paramsList.length === 0) return null;
                      return (
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] opacity-40">Parametry techniczne</h4>
                          <div className="flex flex-wrap gap-2">
                            {paramsList.map((p: any, i: number) => (
                              <div key={i} className="px-4 py-2 bg-surface/50 border border-border rounded-xl flex flex-col justify-center min-w-[100px]">
                                <span className="text-[9px] font-mono text-text-muted uppercase font-bold opacity-60 tracking-wider mb-0.5">{p.label}</span>
                                <span className="text-xs font-bold text-text">{p.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    } catch (e) { return null; }
                  })()}

                  {selectedOffer.description && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] opacity-40">Pełny Opis Oferty</h4>
                      <div className="text-sm text-text-muted leading-relaxed font-sans bg-surface/30 p-6 rounded-2xl border border-border/50 max-h-64 overflow-y-auto whitespace-pre-wrap">
                        {selectedOffer.description}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-8 border-t border-border flex flex-col sm:flex-row gap-4">
                  <a 
                    href={selectedOffer.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex-1 btn-secondary py-5 px-6 rounded-2xl flex items-center justify-center gap-3 text-xs font-bold font-mono text-text-muted hover:text-text transition-all tracking-widest uppercase"
                  >
                    Otwórz w OLX
                    <ExternalLink size={16} />
                  </a>
                  <button 
                    onClick={() => deleteMutation.mutate(selectedOffer.id)}
                    className="py-5 px-10 border border-red-500/30 bg-red-500/5 hover:bg-red-500 hover:text-bg rounded-2xl text-red-500 font-bold font-mono text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} /> Usuń
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
