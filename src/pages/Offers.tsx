import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Calendar, Clock, Image as ImageIcon, ExternalLink, TrendingDown, ChevronLeft, ChevronRight, Filter, Search, Info, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, parseDbDate } from '../lib/utils';

export default function Offers() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectId = searchParams.get('select');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('added_at_desc');
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Handle deep-linking from dashboard
  const { data: deepLoadedOffer } = useQuery({
    queryKey: ['offer-details', selectId],
    queryFn: async () => {
      if (!selectId) return null;
      return (await axios.get(`/api/offers/${selectId}`)).data;
    },
    enabled: !!selectId,
  });

  useEffect(() => {
    if (deepLoadedOffer && selectId) {
      setSelectedOffer(deepLoadedOffer);
      // Clean up URL without refreshing
      setSearchParams({}, { replace: true });
    }
  }, [deepLoadedOffer, selectId, setSearchParams]);

  const { data: slots } = useQuery({
    queryKey: ['slots'],
    queryFn: async () => (await axios.get('/api/slots')).data,
  });

  const { data: cities } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => (await axios.get('/api/cities')).data,
  });

  const [search, setSearch] = useState('');

  const queryParams = new URLSearchParams({ 
    status: 'active',
    page: page.toString(),
    limit: '24'
  });
  if (selectedSlot) queryParams.append('slot_id', selectedSlot);
  if (selectedCity) queryParams.append('city', selectedCity);
  if (priceMin) queryParams.append('price_min', priceMin);
  if (priceMax) queryParams.append('price_max', priceMax);
  if (dateFrom) queryParams.append('date_from', dateFrom);
  if (dateTo) queryParams.append('date_to', dateTo);
  if (sort) queryParams.append('sort', sort);
  if (search) queryParams.append('search', search);

  const { data: response, isLoading } = useQuery({
    queryKey: ['offers', 'active', selectedSlot, selectedCity, priceMin, priceMax, dateFrom, dateTo, sort, search, page],
    queryFn: async () => (await axios.get(`/api/offers?${queryParams.toString()}`)).data,
    refetchInterval: 60000,
  });

  const offers = response?.offers || [];
  const pagination = response?.pagination;

  const { data: priceHistory } = useQuery({
    queryKey: ['price-history', selectedOffer?.id],
    queryFn: async () => (await axios.get(`/api/offers/${selectedOffer.id}/price-history`)).data,
    enabled: !!selectedOffer,
  });

  const checkMutation = useMutation({
    mutationFn: async () => await axios.post('/api/run/check', {}),
  });

  const handleRecheck = () => {
    checkMutation.mutate();
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-bold text-text tracking-tighter">Inwentarz Ofert</h1>
          <p className="text-gray-500 text-sm font-medium">
            Monitorowane ogłoszenia: <span className="text-brand font-bold">{pagination?.total || 0}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleRecheck}
            disabled={checkMutation.isPending}
            className="btn-secondary flex-1 md:flex-none flex items-center justify-center gap-2 h-11 px-6 text-sm"
          >
            <RefreshCw size={18} className={cn(checkMutation.isPending && "animate-spin")} />
            Odśwież dane
          </button>
        </div>
      </div>

      <div className="card p-4 md:p-6 space-y-6 bg-surface/30">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text"
              placeholder="Filtruj modele, marki, opisy treści..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input-field w-full pl-12 h-12 bg-bg/50 border-border/60 focus:bg-bg"
            />
          </div>
          <div className="flex gap-2 w-full lg:w-auto">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "btn-secondary flex items-center justify-center gap-2 h-12 px-6 flex-1 lg:flex-none",
                isFilterOpen && "border-brand text-brand bg-brand/5"
              )}
            >
              <Filter size={18} />
              Parametry
            </button>
            <button 
              onClick={() => {
                setSelectedSlot('');
                setSelectedCity('');
                setPriceMin('');
                setPriceMax('');
                setDateFrom('');
                setDateTo('');
                setSearch('');
                setSort('added_at_desc');
                setPage(1);
              }}
              className="btn-secondary h-12 px-4 hover:text-red-400"
              title="Resetuj filtry"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isFilterOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 pt-4 border-t border-border/50">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">Grupa monitoringu</label>
                  <select 
                    value={selectedSlot} 
                    onChange={e => { setSelectedSlot(e.target.value); setPage(1); }}
                    className="input-field w-full text-sm h-11"
                  >
                    <option value="">Wszystkie sloty</option>
                    {slots?.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">Lokalizacja</label>
                  <select 
                    value={selectedCity} 
                    onChange={e => { setSelectedCity(e.target.value); setPage(1); }}
                    className="input-field w-full text-sm h-11"
                  >
                    <option value="">Wszystkie miasta</option>
                    {cities?.map((c: string) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">Budżet</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={priceMin} 
                      onChange={e => { setPriceMin(e.target.value); setPage(1); }}
                      placeholder="Min"
                      className="input-field w-full text-sm h-11"
                    />
                    <span className="text-gray-600">-</span>
                    <input 
                      type="number" 
                      value={priceMax} 
                      onChange={e => { setPriceMax(e.target.value); setPage(1); }}
                      placeholder="Max"
                      className="input-field w-full text-sm h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">Data dodania</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={dateFrom} 
                      onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                      className="input-field w-full text-sm h-11 px-2"
                    />
                    <span className="text-gray-600">-</span>
                    <input 
                      type="date" 
                      value={dateTo} 
                      onChange={e => { setDateTo(e.target.value); setPage(1); }}
                      className="input-field w-full text-sm h-11 px-2"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">Sortowanie</label>
                  <select 
                    value={sort} 
                    onChange={e => { setSort(e.target.value); setPage(1); }}
                    className="input-field w-full text-sm h-11"
                  >
                    <option value="added_at_desc">Najnowsze</option>
                    <option value="added_at_asc">Najstarsze</option>
                    <option value="price_asc">Cena rosnąco</option>
                    <option value="price_desc">Cena malejąco</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card h-96 animate-pulse bg-surface-hover/20" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {offers.map((offer: any, i: number) => {
              const hasPriceDrop = offer.initial_price && offer.price && offer.price < offer.initial_price;
              const dropPct = hasPriceDrop ? Math.round(((offer.initial_price - offer.price) / offer.initial_price) * 100) : 0;

              return (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (i % 8) * 0.05 }}
                  key={offer.id} 
                  onClick={() => setSelectedOffer(offer)}
                  className="card group cursor-pointer flex flex-col h-full bg-surface/20 border-border/40 hover:border-brand/50 hover:shadow-[0_0_30px_rgba(245,166,35,0.05)] transition-all duration-500"
                >
                  <div className="h-48 bg-bg relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                    
                    {offer.images_count > 0 ? (
                      <img 
                        src={`${offer.images_dir}/0.jpg`} 
                        alt={offer.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-800">
                        <ImageIcon size={40} />
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 flex gap-2 z-20">
                      <div className="bg-surface/80 backdrop-blur-sm border border-border px-2 py-1 rounded text-[9px] font-mono text-white flex items-center gap-1.5">
                        <Clock size={10} className="text-brand" />
                        {parseDbDate(offer.added_at).toLocaleDateString('pl-PL')}
                      </div>
                      <div className="bg-surface/80 backdrop-blur-sm border border-border px-2 py-1 rounded text-[9px] font-mono text-white">
                        {offer.images_count} ZDJ
                      </div>
                    </div>

                    {hasPriceDrop && (
                      <div className="absolute top-3 left-3 flex flex-col items-start gap-1 z-20">
                        <div className="bg-green-500 text-black font-black text-[10px] px-2 py-1 rounded-r-md shadow-xl flex items-center gap-1 leading-none">
                          <TrendingDown size={10} />
                          {dropPct}%
                        </div>
                        <div className="bg-black/80 text-white font-mono text-[8px] px-2 py-0.5 rounded-br-md line-through opacity-80">
                          {offer.initial_price} zł
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-5 flex flex-col flex-1">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={10} className="text-brand" />
                        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold truncate pr-2">{offer.city}</span>
                      </div>
                      <h3 className="text-sm font-bold text-text line-clamp-2 leading-snug group-hover:text-brand transition-colors">
                        {offer.title}
                      </h3>
                      
                      {offer.parameters && offer.parameters !== '[]' && (
                        <div className="mt-3 flex flex-wrap gap-1.5 overflow-hidden max-h-6">
                            {(() => {
                              try {
                                const params = typeof offer.parameters === 'string' ? JSON.parse(offer.parameters) : offer.parameters;
                                if (!Array.isArray(params)) return null;
                                return params.slice(0, 3).map((p: any, idx: number) => {
                                  const text = p.label === 'Typ' ? p.value : `${p.label}: ${p.value}`;
                                  return (
                                    <span key={idx} className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[9px] text-gray-400 whitespace-nowrap">
                                      {text}
                                    </span>
                                  );
                                });
                              } catch(e) { return null; }
                            })()}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">Aktualna cena</p>
                        <p className="text-xl font-bold text-text font-mono leading-none tracking-tight italic">
                          {offer.price ? `${offer.price} zł` : (offer.currency !== 'PLN' ? offer.currency : 'Brak ceny')}
                        </p>
                      </div>
                      
                      <div className="h-10 w-10 rounded-full border border-border/50 flex items-center justify-center group-hover:border-brand/50 group-hover:bg-brand/5 transition-all text-gray-600 group-hover:text-brand">
                        <ExternalLink size={16} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {offers.length === 0 && (
            <div className="card p-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-6 rounded-full bg-surface border border-border text-gray-700">
                <Search size={48} />
              </div>
              <div className="max-w-xs">
                <h3 className="text-lg font-bold text-text">Brak wyników</h3>
                <p className="text-gray-500 text-sm mt-1">Spróbuj zmienić filtry wyszukiwania, aby znaleźć to, czego szukasz.</p>
              </div>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center items-center gap-4 pt-10">
              <button 
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="btn-secondary p-2 disabled:opacity-30"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, pagination.pages) }).map((_, i) => {
                  let pageNum = page;
                  if (page <= 3) pageNum = i + 1;
                  else if (page >= pagination.pages - 2) pageNum = pagination.pages - 4 + i;
                  else pageNum = page - 2 + i;

                  if (pageNum <= 0 || pageNum > pagination.pages) return null;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={cn(
                        "w-10 h-10 rounded-lg text-sm font-mono font-bold transition-all",
                        page === pageNum 
                          ? "bg-brand text-black shadow-lg shadow-brand/20" 
                          : "bg-surface border border-border text-gray-400 hover:text-white hover:border-gray-600"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => handlePageChange(page + 1)}
                disabled={page === pagination.pages}
                className="btn-secondary p-2 disabled:opacity-30"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Offer Details Modal */}
      <AnimatePresence>
        {selectedOffer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOffer(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="card w-full max-w-5xl max-h-full overflow-y-auto relative z-10 flex flex-col md:flex-row bg-bg border border-border sm:rounded-3xl shadow-2xl"
            >
              <button 
                onClick={() => setSelectedOffer(null)}
                className="absolute top-6 right-6 z-20 p-2 bg-black/50 hover:bg-black rounded-full text-white transition-colors cursor-pointer"
              >
                <ChevronLeft size={24} />
              </button>

              <div className="md:w-1/2 bg-bg border-r border-border p-6 space-y-4">
                <div className="aspect-square rounded-xl overflow-hidden border border-border bg-surface">
                  {selectedOffer.images_count > 0 ? (
                    <img 
                      src={`${selectedOffer.images_dir}/0.jpg`} 
                      className="w-full h-full object-contain" 
                      alt="" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-800">
                      <ImageIcon size={64} />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: Math.min(8, selectedOffer.images_count) }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border bg-surface">
                      <img 
                        src={`${selectedOffer.images_dir}/${i}.jpg`} 
                        className="w-full h-full object-cover opacity-60 hover:opacity-100 transition-opacity cursor-pointer" 
                        alt="" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:w-1/2 p-8 md:p-10 space-y-8 flex flex-col">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-1 bg-brand/10 text-brand text-[10px] font-bold uppercase tracking-widest rounded border border-brand/20">Aktywne</span>
                    <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest">ID: {selectedOffer.offer_id}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-text leading-tight">{selectedOffer.title}</h2>
                </div>

                <div className="space-y-6">
                  <div className="flex items-baseline gap-4">
                    <span className="text-4xl font-bold text-brand font-mono tracking-tighter">
                      {selectedOffer.price ? `${selectedOffer.price} zł` : (selectedOffer.currency !== 'PLN' ? selectedOffer.currency : 'Brak ceny')}
                    </span>
                    {selectedOffer.initial_price && selectedOffer.price && selectedOffer.price < selectedOffer.initial_price && (
                      <span className="text-xl text-text-muted/60 line-through font-mono">{selectedOffer.initial_price} zł</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6 py-6 border-y border-border">
                    <div className="space-y-1">
                      <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">Lokalizacja</p>
                      <p className="text-sm text-text font-semibold flex items-center gap-2">
                        <MapPin size={14} className="text-brand" /> {selectedOffer.city}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">Data wystawienia</p>
                      <p className="text-sm text-text font-semibold flex items-center gap-2">
                        <Calendar size={14} className="text-brand" /> {selectedOffer.posted_at}
                      </p>
                    </div>
                  </div>

                  {selectedOffer.parameters && selectedOffer.parameters !== '[]' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-text uppercase tracking-widest flex items-center gap-2">
                        <Info size={14} className="text-brand" />
                        Parametry
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          try {
                            const params = typeof selectedOffer.parameters === 'string' 
                              ? JSON.parse(selectedOffer.parameters) 
                              : selectedOffer.parameters;
                            
                            if (!Array.isArray(params)) return null;

                            return params.map((p: any, i: number) => {
                              const displayText = p.label === 'Typ' ? p.value : `${p.label}: ${p.value}`;
                              return (
                                <div key={i} className="bg-surface border border-border px-3 py-1.5 rounded text-[13px] text-text-muted hover:text-text transition-colors font-medium">
                                  {displayText}
                                </div>
                              );
                            });
                          } catch (e) {
                            return <p className="text-text-muted text-xs italic">Błąd ładowania parametrów</p>;
                          }
                        })()}
                      </div>
                    </div>
                  )}

                  {selectedOffer.description && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-text uppercase tracking-widest flex items-center gap-2">
                        <FileText size={14} className="text-brand" />
                        Opis ogłoszenia
                      </h4>
                      <div className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto pr-4 custom-scrollbar bg-surface/50 p-6 rounded-2xl border border-border">
                        {selectedOffer.description}
                      </div>
                    </div>
                  )}

                  {priceHistory && priceHistory.length > 1 && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-text uppercase tracking-widest flex items-center gap-2">
                        <TrendingDown size={14} className="text-brand" />
                        Historia zmian ceny
                      </h4>
                      <div className="h-40 w-full bg-surface/30 rounded-2xl p-4 border border-border">
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
                              labelFormatter={(val) => parseDbDate(val).toLocaleString('pl-PL')}
                              formatter={(val: number) => [`${val} zł`, 'Cena']}
                            />
                            <Line 
                              type="stepAfter" 
                              dataKey="price" 
                              stroke="var(--color-brand)" 
                              strokeWidth={3} 
                              dot={{ r: 4, fill: 'var(--color-bg)', stroke: 'var(--color-brand)', strokeWidth: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-6">
                  <a 
                    href={selectedOffer.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="btn-primary w-full py-4 flex items-center justify-center gap-3 text-base"
                  >
                    Zobacz ogłoszenie w OLX
                    <ExternalLink size={20} />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
