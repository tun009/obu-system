import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CarIcon from './ui/CarIcon';
import Badge from './ui/Badge';
import ReactDOMServer from 'react-dom/server';
import { Search, X } from 'lucide-react';

// Fix leafet default icon path issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Status config for legend
const STATUS_LEGEND = [
    { key: 'RUNNING',     label: 'Đang chạy', color: '#10b981' },
    { key: 'STOPPED',     label: 'Dừng xe',    color: '#f59e0b' },
    { key: 'PARKED',      label: 'Đỗ xe',      color: '#64748b' },
    { key: 'OFFLINE',     label: 'Mất tín hiệu', color: '#ef4444' },
];

// Create custom SVG Leaflet Marker based on React CarIcon
const createCustomMarker = (status, direction = 0, label = '') => {
    const iconH = label ? 56 : 40; // SVG cao hơn khi có label biển số
    const rawSvg = ReactDOMServer.renderToString(
        <CarIcon status={status} label={label} width={24} height={iconH} />
    );
    return L.divIcon({
        className: 'custom-car-marker',
        html: `<div style="transform: rotate(${direction}deg); transform-origin: 12px 20px; transition: transform 0.5s ease-out;">${rawSvg}</div>`,
        iconSize: [24, iconH],
        iconAnchor: [12, 20],
        popupAnchor: [0, -20]
    });
};

function MapFocus({ selectedVehicle, vehicles }) {
    const map = useMap();
    const isFirstRun = React.useRef(true);

    useEffect(() => {
        if (selectedVehicle && selectedVehicle.lat && selectedVehicle.lng) {
            map.flyTo([selectedVehicle.lat, selectedVehicle.lng], 16, { animate: true, duration: 1.5 });
            isFirstRun.current = false;
        } else if (!selectedVehicle && vehicles && vehicles.length > 0) {
            const validVehicles = vehicles.filter(v => v.lat && v.lng);
            if (validVehicles.length > 0 && isFirstRun.current) {
                map.setView([validVehicles[0].lat, validVehicles[0].lng], 16, { animate: false });
                isFirstRun.current = false;
            }
        }
    }, [selectedVehicle, vehicles?.length, map]);

    return null;
}

// Search component that flies map to searched location
function MapSearchFlyTo({ searchCoords }) {
    const map = useMap();
    useEffect(() => {
        if (searchCoords) {
            map.flyTo([searchCoords.lat, searchCoords.lng], 16, { animate: true, duration: 1.5 });
        }
    }, [searchCoords, map]);
    return null;
}

// Mini car icon for legend (no label, smaller)
function LegendCarIcon({ status }) {
    return <CarIcon status={status} width={16} height={26} style={{ display: 'inline-block', verticalAlign: 'middle' }} />;
}

export default function MapDashboard({ vehicles, selectedVehicle }) {
    const defaultCenter = [21.029754, 105.781992];
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchCoords, setSearchCoords] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchTimeout = useRef(null);
    const dropdownRef = useRef(null);

    // Count vehicles by status
    const statusCounts = STATUS_LEGEND.reduce((acc, s) => {
        acc[s.key] = vehicles.filter(v => {
            if (s.key === 'OFFLINE') return v.status === 'OFFLINE' || v.status === 'LOST_SIGNAL';
            return v.status === s.key;
        }).length;
        return acc;
    }, {});

    // Nominatim search with debounce
    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        
        if (value.trim().length < 2) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&countrycodes=vn&accept-language=vi`
                );
                const data = await res.json();
                setSearchResults(data);
                setShowDropdown(data.length > 0);
            } catch (err) {
                console.error('Search error:', err);
            } finally {
                setIsSearching(false);
            }
        }, 500);
    };

    const handleSelectResult = (result) => {
        setSearchCoords({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
        setSearchQuery(result.display_name.split(',').slice(0, 2).join(', '));
        setShowDropdown(false);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowDropdown(false);
        setSearchCoords(null);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm z-0 relative">
            {/* ── Map Toolbar: Legend + Search (floating overlay) ── */}
            <div className="absolute top-3 left-14 right-4 z-[1000] flex items-center justify-between px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 gap-5">
                {/* Status Legend */}
                <div className="flex items-center gap-5 flex-shrink-0">
                    {STATUS_LEGEND.map(s => (
                        <div key={s.key} className="flex items-center gap-1.5">
                            <LegendCarIcon status={s.key} />
                            <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                                {s.label}
                                {statusCounts[s.key] > 0 && (
                                    <span className="ml-1 text-xs font-bold" style={{ color: s.color }}>
                                        ({statusCounts[s.key]})
                                    </span>
                                )}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 min-w-[300px] max-w-[500px]" ref={dropdownRef}>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm trên bản đồ..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                            className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-gray-50 placeholder-gray-400"
                        />
                        {searchQuery && (
                            <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] max-h-[200px] overflow-y-auto">
                            {searchResults.map((r, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSelectResult(r)}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                                >
                                    <span className="font-medium">{r.display_name.split(',')[0]}</span>
                                    <span className="text-gray-400 text-xs block truncate">{r.display_name}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {isSearching && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] p-3 text-center text-sm text-gray-400">
                            Đang tìm kiếm...
                        </div>
                    )}
                </div>
            </div>

            {/* ── Map (full height, toolbar floats on top) ──── */}
            <div className="w-full h-full">
                <MapContainer center={defaultCenter} zoom={16} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />

                    <MapFocus selectedVehicle={selectedVehicle} vehicles={vehicles} />
                    <MapSearchFlyTo searchCoords={searchCoords} />

                    {vehicles.map((v) => (
                        v.lat && v.lng ? (
                            <Marker
                                key={v.imei}
                                position={[v.lat, v.lng]}
                                icon={createCustomMarker(v.status, v.direction, v.licensePlate || v.imei.slice(-6))}
                                zIndexOffset={selectedVehicle?.imei === v.imei ? 1000 : 0}
                            >
                                <Popup className="obu-popup">
                                    <div className="p-1 min-w-[200px]">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-bold text-gray-800 text-base">{v.licensePlate || v.imei}</h3>
                                            <Badge status={v.status} />
                                        </div>

                                        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                                            <div>
                                                <p className="text-gray-500 text-xs">Km/h</p>
                                                <p className="font-medium">{Math.round(v.speed || 0)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 text-xs">Engine</p>
                                                <p className="font-medium">{v.rpm > 0 ? 'ON' : 'OFF'}</p>
                                            </div>
                                            {/* <div>
                                                <p className="text-gray-500 text-xs">Fuel</p>
                                                <p className="font-medium text-red-600">{v.fuel || 0}%</p>
                                            </div> */}
                                            <div>
                                                <p className="text-gray-500 text-xs">Coolant</p>
                                                <p className="font-medium">{v.coolantTemp || 0}°C</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-gray-500 text-xs">Vị trí (WGS84)</p>
                                                <p className="font-mono text-xs text-gray-700 bg-gray-50 p-1 rounded mt-1">
                                                    Lat: {v.lat.toFixed(5)}, Lng: {v.lng.toFixed(5)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ) : null
                    ))}

                </MapContainer>
            </div>
        </div>
    );
}
