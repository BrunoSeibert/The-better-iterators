'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuthStore } from '@/store/authStore';

const C = {
  darkBrown: 'rgba(38,38,38,1)',
  midBrown: 'rgba(82,82,91,1)',
  tan: 'rgba(161,161,170,1)',
  lightTan: 'rgba(228,228,231,1)',
  cream: 'rgba(250,250,250,1)',
  warmWhite: 'rgba(244,244,245,1)',
  border: 'rgba(212,212,216,1)',
  mutedText: 'rgba(113,113,122,1)',
  uniPin: 'rgba(81,60,45,1)',
};

export interface Professor {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  universityId: string;
  universityName: string;
  researchInterests: string[];
  fieldIds: string[];
  about: string;
  objectives: string[];
  match: number;
}

export interface Expert {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  companyId: string;
  companyName: string;
  companyDomains: string[];
  offerInterviews: boolean;
  fieldIds: string[];
  about: string;
  objectives: string[];
  match: number;
}

interface MapUniversity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  match: number;
}

interface MapCompany {
  id: string;
  name: string;
  lat: number;
  lng: number;
  domains: string[];
  match: number;
}

function makeMarkerIcon(match: number, color: string) {
  const pct = Math.round(match * 100);
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="position:relative;width:22px;height:30px;">
          <span style="position:absolute;left:1px;top:0;display:block;width:20px;height:20px;border-radius:999px 999px 999px 0;background:${color};transform:rotate(-45deg);box-shadow:0 0 0 2px rgba(250,250,250,0.95),0 6px 12px rgba(0,0,0,0.2);"></span>
          <span style="position:absolute;left:6px;top:5px;display:block;width:10px;height:10px;border-radius:999px;background:rgba(250,250,250,1);"></span>
        </div>
        <span style="margin-top:3px;background:${color};color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:99px;white-space:nowrap;">${pct}%</span>
      </div>
    `,
    iconSize: [36, 50],
    iconAnchor: [18, 50],
    popupAnchor: [0, -52],
  });
}

export default function Level2() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [universities, setUniversities] = useState<MapUniversity[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [companies, setCompanies] = useState<MapCompany[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'universities' | 'companies'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedUniversity = universities.find((u) => u.id === selectedUniversityId) ?? null;
  const selectedProfessors = professors
    .filter((p) => p.universityId === selectedUniversityId)
    .sort((a, b) => b.match - a.match);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;
  const selectedExperts = experts
    .filter((e) => e.companyId === selectedCompanyId)
    .sort((a, b) => b.match - a.match);

  const closeSidebar = useCallback(() => {
    setSelectedUniversityId(null);
    setSelectedCompanyId(null);
  }, []);

  const fetchMatches = useCallback(() => {
    setLoading(true);
    setError(null);

    fetch('/api/map/matches', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Server error ${response.status}`);
        }
        return response.json();
      })
      .then((data: { universities?: MapUniversity[]; professors?: Professor[]; companies?: MapCompany[]; experts?: Expert[] }) => {
        if (!Array.isArray(data.universities)) {
          throw new Error('Unexpected response format');
        }
        setUniversities(data.universities);
        setProfessors(Array.isArray(data.professors) ? data.professors : []);
        setCompanies(Array.isArray(data.companies) ? data.companies : []);
        setExperts(Array.isArray(data.experts) ? data.experts : []);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || loading) return;

    mapRef.current = L.map(containerRef.current).setView([47.3769, 8.5417], 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(mapRef.current);
  }, [loading]);

  useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current!.removeLayer(layer);
      }
    });

    if (filter !== 'companies') {
      universities.forEach((uni) => {
        const marker = L.marker([Number(uni.lat), Number(uni.lng)], {
          icon: makeMarkerIcon(uni.match, C.uniPin),
        }).addTo(mapRef.current!);

        marker.bindPopup(
          `<b style="color:rgba(38,38,38,1)">${uni.name}</b><br/><small style="color:rgba(113,113,122,1)">${Math.round(uni.match * 100)}% match · click to see professors</small>`,
        );
        marker.on('click', () => {
          setSelectedUniversityId(uni.id);
          setSelectedCompanyId(null);
          marker.openPopup();
        });
      });
    }

    if (filter !== 'universities') {
      companies.forEach((company) => {
        const marker = L.marker([Number(company.lat), Number(company.lng)], {
          icon: makeMarkerIcon(company.match, C.midBrown),
        }).addTo(mapRef.current!);

        marker.bindPopup(
          `<b style="color:rgba(38,38,38,1)">${company.name}</b><br/><small style="color:rgba(113,113,122,1)">${Math.round(company.match * 100)}% match · click to see experts</small>`,
        );
        marker.on('click', () => {
          setSelectedCompanyId(company.id);
          setSelectedUniversityId(null);
          marker.openPopup();
        });
      });
    }

    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [universities, companies, filter]);

  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 50);
    }
  }, [selectedUniversityId, selectedCompanyId]);

  const sidebarOpen = selectedUniversity !== null || selectedCompany !== null;

  if (loading || error) {
    return (
      <div className="h-full w-full space-y-6 rounded-lg p-6" style={{ backgroundColor: C.warmWhite }}>
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: C.darkBrown }}>Find your Professor</h1>
          <p className="mt-1 text-sm" style={{ color: C.mutedText }}>
            {error ? 'Failed to load matches' : 'Computing AI matches...'}
          </p>
        </div>
        <div
          className="relative flex h-[calc(100%-5rem)] items-center justify-center rounded-none"
          style={{ border: `3px solid ${C.border}`, backgroundColor: C.cream }}
        >
          {error ? (
            <div className="flex flex-col items-center gap-3 px-8 text-center">
              <p className="text-sm font-semibold" style={{ color: C.darkBrown }}>Could not load matches</p>
              <p className="text-xs" style={{ color: C.mutedText }}>{error}</p>
              <button
                onClick={fetchMatches}
                className="rounded-[0.32rem] border-2 px-5 py-2 text-sm font-semibold transition"
                style={{
                  borderColor: 'black',
                  backgroundColor: 'black',
                  color: 'white',
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div
                className="h-10 w-10 animate-spin rounded-full border-[3px]"
                style={{ borderColor: C.lightTan, borderTopColor: C.darkBrown }}
              />
              <p className="text-sm font-semibold" style={{ color: C.darkBrown }}>Loading map...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 rounded-lg p-6" style={{ backgroundColor: C.warmWhite }}>
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: C.darkBrown }}>Find your Professor</h1>
          <p className="mt-1 text-sm" style={{ color: C.mutedText }}>
            {universities.length} universities · {companies.length} companies matched to your profile
          </p>
        </div>
        <div className="flex items-center gap-2">
          {([
            { key: 'all', label: `All (${universities.length + companies.length})` },
            { key: 'companies', label: 'Companies' },
            { key: 'universities', label: 'Universities' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setFilter(key);
                closeSidebar();
              }}
              className={`rounded-[0.32rem] border-2 px-[clamp(0.85rem,2.8vw,1.25rem)] py-[clamp(0.42rem,1.5vw,0.5rem)] text-[clamp(0.95rem,2.5vw,1rem)] font-semibold transition ${
                filter === key
                  ? 'border-black bg-black text-white hover:bg-[rgba(28,28,28,1)]'
                  : 'border-[rgba(178,178,178,0.98)] bg-[rgba(236,236,236,0.98)] text-[rgba(68,68,68,1)] hover:bg-[rgba(225,225,225,0.98)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <div
          className="relative min-w-0 flex-1 overflow-hidden rounded-none"
          style={{ border: `3px solid ${C.border}`, isolation: 'isolate' }}
        >
          <div ref={containerRef} className="absolute inset-0 leaflet-container" />
        </div>

        {sidebarOpen && (
          <div
            className="flex shrink-0 flex-col overflow-hidden rounded-lg"
            style={{ width: 300, backgroundColor: C.cream, border: `2px solid ${C.border}` }}
          >
            <div
              className="flex shrink-0 items-center justify-between px-4 py-4"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.mutedText }}>
                  {selectedUniversity ? 'Professors at' : 'Experts at'}
                </p>
                <p className="mt-0.5 truncate text-sm font-bold" style={{ color: C.darkBrown }}>
                  {selectedUniversity?.name ?? selectedCompany?.name}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: C.mutedText }}>
                  {selectedUniversity ? `${selectedProfessors.length} professors` : `${selectedExperts.length} experts`}
                </p>
              </div>
              <button
                onClick={closeSidebar}
                style={{
                  flexShrink: 0,
                  marginLeft: 8,
                  color: C.mutedText,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: '4px 8px',
                }}
              >
                x
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin' }}>
              {selectedUniversity && (
                selectedProfessors.length === 0 ? (
                  <p className="mt-8 text-center text-sm" style={{ color: C.mutedText }}>No professors found.</p>
                ) : (
                  selectedProfessors.map((prof) => (
                    <button
                      key={prof.id}
                      onClick={() => navigate(`/professor/${prof.id}`, { state: { professor: prof } })}
                      className="flex flex-col gap-3 rounded-lg p-4 text-left transition hover:shadow-md"
                      style={{ backgroundColor: C.warmWhite, border: `2px solid ${C.border}`, cursor: 'pointer' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                          style={{ backgroundColor: C.lightTan, color: C.darkBrown }}
                        >
                          {prof.firstName[0]}{prof.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold" style={{ color: C.darkBrown }}>
                            {prof.firstName} {prof.lastName}
                          </p>
                          <p className="truncate text-xs" style={{ color: C.mutedText }}>{prof.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: C.lightTan }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.round(prof.match * 100)}%`, backgroundColor: C.darkBrown }}
                          />
                        </div>
                        <span className="shrink-0 text-xs font-bold" style={{ color: C.darkBrown }}>
                          {Math.round(prof.match * 100)}%
                        </span>
                      </div>
                      {prof.researchInterests.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {prof.researchInterests.slice(0, 3).map((interest) => (
                            <span
                              key={interest}
                              className="rounded-full px-2 py-0.5 text-xs"
                              style={{ backgroundColor: C.lightTan, color: C.midBrown }}
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs font-medium" style={{ color: C.tan }}>View profile -&gt;</p>
                    </button>
                  ))
                )
              )}

              {selectedCompany && (
                selectedExperts.length === 0 ? (
                  <p className="mt-8 text-center text-sm" style={{ color: C.mutedText }}>No experts found.</p>
                ) : (
                  selectedExperts.map((expert) => (
                    <button
                      key={expert.id}
                      onClick={() => navigate(`/expert/${expert.id}`, { state: { expert } })}
                      className="flex flex-col gap-3 rounded-lg p-4 text-left transition hover:shadow-md"
                      style={{ backgroundColor: C.warmWhite, border: `2px solid ${C.border}`, cursor: 'pointer' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                          style={{ backgroundColor: C.lightTan, color: C.midBrown }}
                        >
                          {expert.firstName[0]}{expert.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold" style={{ color: C.darkBrown }}>
                            {expert.firstName} {expert.lastName}
                          </p>
                          <p className="truncate text-xs" style={{ color: C.mutedText }}>{expert.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: C.lightTan }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.round(expert.match * 100)}%`, backgroundColor: C.midBrown }}
                          />
                        </div>
                        <span className="shrink-0 text-xs font-bold" style={{ color: C.midBrown }}>
                          {Math.round(expert.match * 100)}%
                        </span>
                      </div>
                      {expert.companyDomains.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {expert.companyDomains.slice(0, 3).map((domain) => (
                            <span
                              key={domain}
                              className="rounded-full px-2 py-0.5 text-xs"
                              style={{ backgroundColor: C.lightTan, color: C.midBrown }}
                            >
                              {domain}
                            </span>
                          ))}
                        </div>
                      )}
                      {expert.offerInterviews && (
                        <span className="text-xs font-semibold" style={{ color: C.darkBrown }}>Offers interviews</span>
                      )}
                      <p className="text-xs font-medium" style={{ color: C.tan }}>View profile -&gt;</p>
                    </button>
                  ))
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
