import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Search } from 'lucide-react';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  address?: string;
}

const RecenterMap = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
};

const LocationMarker = ({ position, setPosition }: { position: { lat: number, lng: number } | null, setPosition: (pos: { lat: number, lng: number }) => void }) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
};

const MapModal: React.FC<LocationPickerModalProps> = ({ isOpen, onClose, onConfirm, initialLat, initialLng, address }) => {
  const [position, setPosition] = useState<{ lat: number, lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-23.5505, -46.6333]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (initialLat && initialLng) {
      const pos = { lat: initialLat, lng: initialLng };
      setPosition(pos);
      setMapCenter([initialLat, initialLng]);
    } else if (address && isOpen) {
        // If no coordinates but address is provided, search automatically
        handleSearch(address);
    }
  }, [initialLat, initialLng, address, isOpen]);

  const handleSearch = async (query: string) => {
    if (!query) return;
    setLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const newPos = { lat, lng: lon };
        setPosition(newPos);
        setMapCenter([lat, lon]);
      } else {
        alert("Endereço não encontrado. Tente simplificar a busca.");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      alert("Erro ao buscar endereço. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <h3 className="text-lg font-bold text-[color:var(--color-text)]">Selecionar Localização</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-[color:var(--color-muted)]">✕</button>
        </div>
        
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex gap-2">
            <div className="flex-1 relative">
                <input 
                    type="text" 
                    placeholder="Buscar endereço..." 
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm font-medium"
                    defaultValue={address || ''}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery || address || '')}
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <button 
                onClick={() => handleSearch(searchQuery || address || '')}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
                {loading ? 'Buscando...' : 'Buscar'}
            </button>
        </div>

        <div className="flex-1 relative">
           <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <RecenterMap center={mapCenter} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker position={position} setPosition={setPosition} />
          </MapContainer>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-[color:var(--color-muted)] hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (position) {
                onConfirm(position.lat, position.lng);
                onClose();
              } else {
                alert("Por favor, selecione um local no mapa.");
              }
            }}
            className="px-4 py-2 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors shadow-lg shadow-emerald-100"
          >
            Confirmar Localização
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapModal;
