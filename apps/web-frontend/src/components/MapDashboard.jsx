import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CarIcon from './ui/CarIcon';
import Badge from './ui/Badge';
import ReactDOMServer from 'react-dom/server';

// Fix leafet default icon path issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create custom SVG Leaflet Marker based on React CarIcon
const createCustomMarker = (status, direction = 0) => {
    const rawSvg = ReactDOMServer.renderToString(<CarIcon status={status} width={24} height={40} />);
    return L.divIcon({
        className: 'custom-car-marker',
        html: `<div style="transform: translateY(-50%) translateX(-50%) rotate(${direction}deg); transition: transform 0.5s ease-out;">${rawSvg}</div>`,
        iconSize: [24, 40],
        iconAnchor: [12, 20], // Center
        popupAnchor: [0, -20]
    });
};

function MapFocus({ selectedVehicle, vehicles }) {
    const map = useMap();
    const isFirstRun = React.useRef(true);

    useEffect(() => {
        if (selectedVehicle && selectedVehicle.lat && selectedVehicle.lng) {
            // Focus ONLY when an explicitly selected vehicle is clicked
            map.flyTo([selectedVehicle.lat, selectedVehicle.lng], 16, { animate: true, duration: 1.5 });
            isFirstRun.current = false;
        } else if (!selectedVehicle && vehicles && vehicles.length > 0) {
            // Default focus on the very first vehicle available in the list
            const validVehicles = vehicles.filter(v => v.lat && v.lng);
            if (validVehicles.length > 0 && isFirstRun.current) {
                // Instantly snap to the first vehicle on first load
                map.setView([validVehicles[0].lat, validVehicles[0].lng], 16, { animate: false });
                isFirstRun.current = false;
            }
        }
    }, [selectedVehicle, vehicles?.length, map]);

    return null;
}

export default function MapDashboard({ vehicles, selectedVehicle }) {
    const defaultCenter = [21.029754, 105.781992];

    return (
        <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200 relative bg-white shadow-sm z-0">
            <MapContainer center={defaultCenter} zoom={16} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />

                <MapFocus selectedVehicle={selectedVehicle} vehicles={vehicles} />

                {vehicles.map((v) => (
                    v.lat && v.lng ? (
                        <Marker
                            key={v.imei}
                            position={[v.lat, v.lng]}
                            icon={createCustomMarker(v.status, v.direction)}
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
                                        <div>
                                            <p className="text-gray-500 text-xs">Fuel</p>
                                            <p className="font-medium text-red-600">{v.fuel || 0}%</p>
                                        </div>
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
    );
}
