'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapMatch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'company' | 'university';
  description?: string;
  match: number;
}

const markerIcon = L.divIcon({
  className: 'custom-map-marker',
  html: `
    <div style="position:relative;width:22px;height:30px;">
      <span style="position:absolute;left:1px;top:0;display:block;width:20px;height:20px;border-radius:999px 999px 999px 0;background:#5d4330;transform:rotate(-45deg);box-shadow:0 0 0 2px rgba(248,241,232,0.95), 0 6px 12px rgba(48,36,25,0.24);"></span>
      <span style="position:absolute;left:6px;top:5px;display:block;width:10px;height:10px;border-radius:999px;background:#f8f1e8;"></span>
    </div>
  `,
  iconSize: [22, 30],
  iconAnchor: [11, 30],
  popupAnchor: [0, -26],
});

function buildPopupContent(match: MapMatch) {
  return `
    <div style="min-width: 200px; color: #2f2f2f;">
      <b>${match.name}</b><br/>
      <small style="color: #7a7a7a;">${match.type}</small><br/>
      ${match.description ? `<small style="color: #555;">${match.description}</small><br/>` : ''}
      <div style="margin-top: 8px; color: #4a4a4a; font-weight: 700;">
        ${(match.match * 100).toFixed(0)}% Match
      </div>
    </div>
  `;
}

export default function Level2() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [allMatches, setAllMatches] = useState<MapMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'companies' | 'universities'>('all');

  useEffect(() => {
    fetch('http://localhost:3001/api/map/matches')
      .then((res) => res.json())
      .then((data) => {
        setAllMatches(data);
        setLoading(false);
      })
      .catch(() => {
        const mockData: MapMatch[] = [
          { id: '1', name: 'Google Zurich', lat: 47.3769, lng: 8.5417, type: 'company', description: 'AI Research', match: 0.92 },
          { id: '2', name: 'ETH Zurich', lat: 47.398, lng: 8.543, type: 'university', match: 0.85 },
          { id: '3', name: 'ZHAW Winterthur', lat: 47.505, lng: 8.725, type: 'university', match: 0.78 },
          { id: '4', name: 'IBM Research', lat: 47.364, lng: 8.515, type: 'company', match: 0.88 },
        ];
        setAllMatches(mockData);
        setLoading(false);
      });
  }, []);

  const addMarkers = (matches: MapMatch[]) => {
    if (!mapRef.current) return;

    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current!.removeLayer(layer);
      }
    });

    matches.forEach((match) => {
      L.marker([match.lat, match.lng], { icon: markerIcon })
        .addTo(mapRef.current!)
        .bindPopup(buildPopupContent(match));
    });

    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current || loading || allMatches.length === 0) return;

    mapRef.current = L.map(containerRef.current).setView([47.3769, 8.5417], 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(mapRef.current);

    addMarkers(allMatches);
  }, [allMatches, loading]);

  const handleFilter = (type: 'all' | 'companies' | 'universities') => {
    setFilter(type);
    if (!allMatches.length) return;

    let filtered = allMatches;
    if (type === 'companies') filtered = allMatches.filter((m) => m.type === 'company');
    if (type === 'universities') filtered = allMatches.filter((m) => m.type === 'university');

    addMarkers(filtered);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center rounded-xl bg-[var(--panel-warm)] p-8">
        <div className="chunky-panel px-8 py-6 text-lg font-semibold text-[var(--foreground)]">
          Loading map...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full space-y-6 rounded-lg bg-[var(--panel-warm)] p-6 text-[var(--foreground)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Find your Professor
          </h1>
          <p className="mt-1 text-[var(--stroke-brown-soft)]">
            {filter === 'all'
              ? allMatches.length
              : allMatches.filter((m) => m.type === (filter === 'companies' ? 'company' : 'university')).length}{' '}
            {filter} near Winterthur
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleFilter('all')}
            className={`rounded-[0.32rem] border-2 px-[clamp(0.85rem,2.8vw,1.25rem)] py-[clamp(0.42rem,1.5vw,0.5rem)] text-[clamp(0.95rem,2.5vw,1rem)] font-semibold transition ${
              filter === 'all'
                ? 'border-black bg-black text-white hover:bg-[rgba(28,28,28,1)]'
                : 'border-[rgba(178,178,178,0.98)] bg-[rgba(236,236,236,0.98)] text-[rgba(68,68,68,1)] hover:bg-[rgba(225,225,225,0.98)]'
            }`}
          >
            All ({allMatches.length})
          </button>
          <button
            onClick={() => handleFilter('companies')}
            className={`rounded-[0.32rem] border-2 px-[clamp(0.85rem,2.8vw,1.25rem)] py-[clamp(0.42rem,1.5vw,0.5rem)] text-[clamp(0.95rem,2.5vw,1rem)] font-semibold transition ${
              filter === 'companies'
                ? 'border-black bg-black text-white hover:bg-[rgba(28,28,28,1)]'
                : 'border-[rgba(178,178,178,0.98)] bg-[rgba(236,236,236,0.98)] text-[rgba(68,68,68,1)] hover:bg-[rgba(225,225,225,0.98)]'
            }`}
          >
            Companies
          </button>
          <button
            onClick={() => handleFilter('universities')}
            className={`rounded-[0.32rem] border-2 px-[clamp(0.85rem,2.8vw,1.25rem)] py-[clamp(0.42rem,1.5vw,0.5rem)] text-[clamp(0.95rem,2.5vw,1rem)] font-semibold transition ${
              filter === 'universities'
                ? 'border-black bg-black text-white hover:bg-[rgba(28,28,28,1)]'
                : 'border-[rgba(178,178,178,0.98)] bg-[rgba(236,236,236,0.98)] text-[rgba(68,68,68,1)] hover:bg-[rgba(225,225,225,0.98)]'
            }`}
          >
            Universities
          </button>
        </div>
      </div>

      <div className="relative h-[calc(100%-6rem)] min-h-0 overflow-hidden rounded-none border-[3px] border-[var(--stroke-brown)] bg-[var(--panel-cream)] shadow-none">
        <div ref={containerRef} className="absolute inset-0 leaflet-container" />
      </div>
    </div>
  );
}
