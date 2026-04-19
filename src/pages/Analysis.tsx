import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { RefreshCw, TrendingUp, MapPin, Activity, DollarSign, PieChart as PieIcon, ArrowRight, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { cn } from '../lib/utils';

const COLORS = ['#F5A623', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#EF4444'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface/90 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-2xl outline-none">
        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-8">
              <span className="text-xs text-gray-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="text-sm font-bold text-white font-mono">
                {entry.value}{entry.name.includes('Cena') || entry.name.includes('Pieniądz') ? ' zł' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function Analysis() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { data: offersResponse } = useQuery({
    queryKey: ['all-offers-analysis'],
    queryFn: async () => (await axios.get('/api/offers?limit=5000')).data,
  });

  const { data: slots } = useQuery({
    queryKey: ['slots'],
    queryFn: async () => (await axios.get('/api/slots')).data,
  });

  if (!offersResponse || !slots) return (
    <div className="p-10 flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <RefreshCw size={32} className="animate-spin text-brand" />
        <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Analizowanie danych rynkowych...</p>
      </div>
    </div>
  );

  const allOffers = (offersResponse.offers || []).filter((o: any) => {
    return o.price > 10 && o.price < 500000;
  });

  // Stats calculation
  const soldOffers = allOffers.filter((o: any) => o.status === 'sold_or_removed');
  const activeOffers = allOffers.filter((o: any) => o.status === 'active');
  
  const slotStats = slots.map((slot: any) => {
    const slotOffers = allOffers.filter((o: any) => o.slot_id === slot.id);
    const prices = slotOffers.map((o: any) => o.price).sort((a, b) => a - b);
    
    const medianPrice = prices.length > 0 
      ? (prices.length % 2 === 0 
          ? (prices[prices.length/2 - 1] + prices[prices.length/2]) / 2 
          : prices[Math.floor(prices.length/2)])
      : 0;

    const avgPrice = slotOffers.length > 0 
      ? slotOffers.reduce((sum: number, o: any) => sum + o.price, 0) / slotOffers.length 
      : 0;

    return {
      name: slot.name.length > 15 ? slot.name.substring(0, 12) + '...' : slot.name,
      fullName: slot.name,
      avgPrice: Math.round(avgPrice),
      medianPrice: Math.round(medianPrice),
      count: slotOffers.length
    };
  }).filter((s: any) => s.count > 0);

  const statusData = [
    { name: 'Aktywne', value: activeOffers.length },
    { name: 'Zakończone', value: soldOffers.length }
  ];

  const cityCounts = allOffers.reduce((acc: any, offer: any) => {
    if (offer.city) acc[offer.city] = (acc[offer.city] || 0) + 1;
    return acc;
  }, {});

  const topCities = Object.entries(cityCounts)
    .map(([city, count]) => ({ city, count }))
    .sort((a: any, b: any) => (b.count as number) - (a.count as number))
    .slice(0, 7);

  const priceRanges = [
    { label: '0-500', min: 0, max: 500 },
    { label: '500-1k', min: 500, max: 1000 },
    { label: '1k-2k', min: 1000, max: 2000 },
    { label: '2k-3k', min: 2000, max: 3000 },
    { label: '3k-5k', min: 3000, max: 5000 },
    { label: '5k+', min: 5000, max: 1000000 },
  ];

  const priceTrends = priceRanges.map(range => {
    const rActive = activeOffers.filter((o: any) => o.price >= range.min && o.price < range.max);
    const rSold = soldOffers.filter((o: any) => o.price >= range.min && o.price < range.max);
    return {
      range: range.label,
      active: rActive.length,
      sold: rSold.length,
    };
  });

  const generatePdf = async () => {
    if (!contentRef.current) return;
    setIsExporting(true);
    
    // Disable animations temporarily for capture
    const originalTransitions = document.body.style.getPropertyValue('*') || '';
    document.body.style.setProperty('--recharts-animation-duration', '0ms');
    
    // Add temporary class to container to freeze specific problematic elements
    contentRef.current.classList.add('pdf-export-mode');

    try {
      // Extended delay to allow charts to fully skip animation frames
      await new Promise(r => setTimeout(r, 600));
      
      const imgData = await toPng(contentRef.current, {
        cacheBust: true,
        backgroundColor: '#0A0A0A',
        pixelRatio: 2,
        style: {
          transform: 'none', // Prevent any transforms from messing up the capture
        },
        filter: (node) => {
          // Exclude elements with the ignore class
          if (node.classList && node.classList.contains('export-ignore')) {
            return false;
          }
          return true;
        }
      });
      
      const pxWidth = contentRef.current.offsetWidth;
      const pxHeight = contentRef.current.offsetHeight;
      
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = (pxHeight * pdfWidth) / pxWidth;
      
      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [Math.max(pdfWidth, 100), Math.max(pdfHeight, 100)] // Safety min dimensions
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('raport-olx-tracker.pdf');
    } catch (e) {
      console.error('Błąd przy generowaniu PDF:', e);
    } finally {
      setIsExporting(false);
      document.body.style.setProperty('--recharts-animation-duration', '');
      contentRef.current?.classList.remove('pdf-export-mode');
    }
  };

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-8 relative" ref={contentRef}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tighter">Analiza Rynku</h1>
          <p className="text-gray-500 text-sm font-medium">
            Przetworzono <span className="text-brand font-bold">{allOffers.length}</span> punktów danych.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Razem Ofert', value: allOffers.length, icon: Activity, color: 'text-brand', sub: 'Wszystkie przeanalizowane' },
          { label: 'Średnia cena', value: `${Math.round(allOffers.reduce((a:any, b:any) => a + b.price, 0) / (allOffers.length || 1))} zł`, icon: DollarSign, color: 'text-green-500', sub: 'Aktualna rynkowa' },
          { label: 'Skuteczność Sprzedaży', value: `${Math.round((soldOffers.length / (allOffers.length || 1)) * 100)}%`, icon: TrendingUp, color: 'text-blue-500', sub: 'Rotacja względem całości' },
          { label: 'Najpopularniejsze miasto', value: topCities[0]?.city || '-', icon: MapPin, color: 'text-purple-500', sub: 'Najwięcej zgłoszeń' },
        ].map((item, i) => (
          <div key={i} className="card p-5 md:p-6 border-l-4 border-l-brand/20 hover:border-l-brand transition-all">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <div className={cn("p-2 rounded-lg bg-bg border border-border", item.color)}>
                <item.icon size={16} className="md:w-[18px] md:h-[18px]" />
              </div>
            </div>
            <p className="text-[9px] md:text-[10px] text-gray-500 font-mono uppercase tracking-[0.2em]">{item.label}</p>
            <h3 className="text-xl md:text-2xl font-bold text-white mt-1">{item.value}</h3>
            <p className="text-[9px] md:text-[10px] text-gray-600 font-mono mt-1 italic">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        
        {/* Market Pricing Map */}
        <div className="card p-4 md:p-8 bg-surface/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-10 pb-4 border-b border-border gap-4">
            <div>
              <h2 className="text-xs md:text-sm font-bold text-white flex items-center gap-3">
                <DollarSign size={14} className="text-brand" />
                Mapa cenowa grup
              </h2>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 text-[8px] md:text-[10px] text-brand font-mono">
                <div className="w-1 h-1 rounded-full bg-brand" /> ŚREDNIA
              </div>
              <div className="flex items-center gap-1.5 text-[8px] md:text-[10px] text-blue-500 font-mono">
                <div className="w-1 h-1 rounded-full bg-blue-500" /> MEDIANA
              </div>
            </div>
          </div>
          <div className="h-60 md:h-80 outline-none [&_.recharts-wrapper]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slotStats} margin={{ bottom: 10, left: -25, right: 10 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#444" 
                  fontSize={8} 
                  tick={{ fill: '#666' }}
                  interval={slotStats.length > 6 ? 1 : 0}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis 
                  stroke="#444" 
                  fontSize={8} 
                  tick={{ fill: '#666' }}
                  tickFormatter={(val) => `${val > 999 ? `${(val/1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="avgPrice" name="Średnia" fill="#F5A623" radius={[2, 2, 0, 0]} barSize={slotStats.length > 8 ? 8 : 16} isAnimationActive={!isExporting} />
                <Bar dataKey="medianPrice" name="Mediana" fill="#3B82F6" radius={[2, 2, 0, 0]} barSize={slotStats.length > 8 ? 8 : 16} isAnimationActive={!isExporting} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status ogłoszeń */}
        <div className="card p-4 md:p-8 bg-surface/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-10 pb-4 border-b border-border gap-4">
            <div>
              <h2 className="text-xs md:text-sm font-bold text-white flex items-center gap-3">
                <Activity size={14} className="text-brand" />
                Stan Ogłoszeń (Aktywne vs Zakończone)
              </h2>
            </div>
            <div className="flex gap-3 text-right">
              <span className="text-[8px] md:text-[10px] text-brand font-bold uppercase">Pozostałe w sieci</span>
              <span className="text-[8px] md:text-[10px] text-green-500 font-bold uppercase">Zniknęły lub sprzedane</span>
            </div>
          </div>
          <div className="h-60 md:h-80 outline-none [&_.recharts-wrapper]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceTrends} margin={{ left: -25, right: 10 }}>
                <defs>
                  <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F5A623" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#F5A623" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradSold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="range" stroke="#444" fontSize={8} tick={{ fill: '#666' }} />
                <YAxis stroke="#444" fontSize={8} tick={{ fill: '#666' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="active" 
                  name="Aktywne" 
                  stroke="#F5A623" 
                  strokeWidth={1.5}
                  fillOpacity={1} 
                  fill="url(#gradActive)" 
                  isAnimationActive={!isExporting}
                />
                <Area 
                  type="monotone" 
                  dataKey="sold" 
                  name="Sprzedane" 
                  stroke="#10B981" 
                  strokeWidth={1.5}
                  fillOpacity={1} 
                  fill="url(#gradSold)" 
                  isAnimationActive={!isExporting}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* City Popularity */}
        <div className="card p-5 md:p-8 bg-surface/30">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-3">
                <MapPin size={16} className="text-brand" />
                Lokalizacje
              </h2>
            </div>
          </div>
          <div className="h-64 md:h-80 outline-none [&_.recharts-wrapper]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCities} layout="vertical" margin={{ left: -10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#444" fontSize={9} hide />
                <YAxis 
                  dataKey="city" 
                  type="category" 
                  stroke="#888" 
                  fontSize={10} 
                  width={80}
                  tick={{ fill: '#888', fontWeight: 500 }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="count" name="Liczba Ofert" fill="#10B981" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={!isExporting}>
                  {topCities.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Database Health/Status */}
        <div className="card p-5 md:p-8 bg-surface/30">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-3">
                <PieIcon size={16} className="text-brand" />
                Status bazy
              </h2>
            </div>
          </div>
          <div className="h-56 md:h-80 flex items-center justify-center relative outline-none [&_.recharts-wrapper]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="85%"
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={!isExporting}
                >
                  <Cell fill="#F5A623" />
                  <Cell fill="#111111" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl md:text-3xl font-bold text-white leading-none">{allOffers.length}</span>
              <span className="text-[8px] md:text-[9px] text-gray-500 font-mono uppercase tracking-widest mt-1">Suma</span>
            </div>
          </div>
          <div className="flex justify-center gap-4 md:gap-8 mt-2 md:mt-4">
            {statusData.map((entry, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: index === 0 ? '#F5A623' : '#111111', border: index === 1 ? '1px solid #333' : 'none' }} />
                <span className="text-[8px] md:text-[9px] font-mono text-gray-400 uppercase tracking-widest">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="flex justify-end export-ignore">
        <button 
          onClick={generatePdf}
          disabled={isExporting}
          className="btn-primary flex items-center gap-3 group px-8 py-3.5 w-full md:w-auto justify-center shadow-lg shadow-brand/20 disabled:opacity-50"
        >
          {isExporting ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Generowanie PDF...
            </>
          ) : (
            <>
              <Download size={18} className="group-hover:-translate-y-0.5 transition-transform" />
              Pobierz Raport PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
}
