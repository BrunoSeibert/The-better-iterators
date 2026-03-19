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
}

export default function Level2() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [allMatches, setAllMatches] = useState<MapMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'companies' | 'universities'>('all');

  // Load data ONCE
  useEffect(() => {
    fetch('http://localhost:3001/api/map/matches')
      .then(res => res.json())
      .then(data => {
        setAllMatches(data);
        setLoading(false);
      })
      .catch(() => {
        // Mock data
        const mockData: MapMatch[] = [
          { id: "1", name: "Google Zurich", lat: 47.3769, lng: 8.5417, type: "company", description: "AI Research" },
          { id: "2", name: "ETH Zurich", lat: 47.398, lng: 8.543, type: "university" },
          { id: "3", name: "ZHAW Winterthur", lat: 47.505, lng: 8.725, type: "university" },
          { id: "4", name: "IBM Research", lat: 47.364, lng: 8.515, type: "company" }
        ];
        setAllMatches(mockData);
        setLoading(false);
      });
  }, []);

  // Init map when container ready (runs once)
  useEffect(() => {
    if (!containerRef.current || mapRef.current || loading || allMatches.length === 0) return;

    mapRef.current = L.map(containerRef.current).setView([47.3769, 8.5417], 11);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapRef.current);

    // Add all markers
    allMatches.forEach(match => {
      L.marker([match.lat, match.lng])
        .addTo(mapRef.current!)
        .bindPopup(`
          <div style="min-width: 200px;">
            <b>${match.name}</b><br/>
            <small style="color: #666;">${match.type}</small><br/>
            ${match.description ? `<small>${match.description}</small>` : ''}
            <div style="margin-top: 8px; color: #10b981; font-weight: bold;">92% Match ✨</div>
          </div>
        `);
    });

    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [allMatches, loading]); // Fixed: stable deps

  const updateMarkers = (matches: MapMatch[]) => {
    if (!mapRef.current) return;

    // Clear existing markers
    mapRef.current.eachLayer(layer => {
      if (layer instanceof L.Marker) {
        mapRef.current!.removeLayer(layer);
      }
    });

    // Add new markers
    matches.forEach(match => {
      L.marker([match.lat, match.lng])
        .addTo(mapRef.current!)
        .bindPopup(`
          <div style="min-width: 200px;">
            <b>${match.name}</b><br/>
            <small style="color: #666;">${match.type}</small><br/>
            ${match.description ? `<small>${match.description}</small>` : ''}
            <div style="margin-top: 8px; color: #10b981; font-weight: bold;">{m}</div>
          </div>
        `);
    });

    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  };

  const handleFilter = (type: 'all' | 'companies' | 'universities') => {
    setFilter(type);
    if (!allMatches.length) return;

    let filtered = allMatches;
    if (type === 'companies') filtered = allMatches.filter(m => m.type === 'company');
    if (type === 'universities') filtered = allMatches.filter(m => m.type === 'university');
    
    updateMarkers(filtered);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl p-8">
        <div className="text-white text-xl animate-pulse">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full p-6 space-y-6 bg-neutral-200/70 rounded-lg overflow-hidden flex flex-col">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🎯 Your Perfect Matches
          </h1>
          <p className="text-gray-600 mt-1">
            {filter === 'all' ? allMatches.length : allMatches.filter(m => m.type === (filter === 'companies' ? 'company' : 'university')).length} {filter} near Winterthur
          </p>
        </div>
        <div className="flex bg-white/80 px-4 py-2 rounded-xl shadow-lg space-x-2">
          <button
            onClick={() => handleFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            All ({allMatches.length})
          </button>
          <button
            onClick={() => handleFilter('companies')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'companies' ? 'bg-green-600 text-white shadow-md' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
            }`}
          >
            Companies
          </button>
          <button
            onClick={() => handleFilter('universities')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'universities' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
            }`}
          >
            Universities
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl shadow-2xl overflow-hidden bg-white relative">
        <div ref={containerRef} className="absolute inset-0 leaflet-container" />
      </div>
    </div>
  );
}




