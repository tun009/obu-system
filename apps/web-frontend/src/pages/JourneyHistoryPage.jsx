import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useVehicles } from '../context/VehicleContext';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { FileSpreadsheet } from 'lucide-react';
import { formatJourneyData } from '../utils/journeyFormatter';

// Format Date to YYYY-MM-DDTHH:mm string for datetime-local input
const formatDateTimeLocal = (date) => {
    return (new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString()).slice(0, 16);
};

function JourneyMap({ formattedLogs, zoomToLog }) {
    const map = useMap();

    useEffect(() => {
        if (zoomToLog && zoomToLog.lat && zoomToLog.lng) {
            map.flyTo([zoomToLog.lat, zoomToLog.lng], 16, { animate: true });
        } else if (formattedLogs && formattedLogs.length > 0) {
            const validPoints = formattedLogs.filter(p => p.lat && p.lng);
            if (validPoints.length > 0) {
                const bounds = L.latLngBounds(validPoints.map(s => [s.lat, s.lng]));
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    }, [zoomToLog, formattedLogs, map]);

    const allPoints = (formattedLogs || [])
        .filter(p => !isNaN(p.lat) && !isNaN(p.lng))
        .map(p => [p.lat, p.lng]);

    const getMarkerColor = (status) => {
        switch (status) {
            case 'RUNNING': return '#22c55e'; // green-500
            case 'STOPPED': return '#f59e0b'; // amber-500
            case 'PARKED': return '#6b7280'; // gray-500
            default: return '#ef4444'; // red-500
        }
    };

    const createIcon = (color) => L.divIcon({
        className: 'custom-history-marker',
        html: `<div style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 2px rgba(0,0,0,0.3);"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5]
    });

    return (
        <>
            <Polyline positions={allPoints} color="#3b82f6" weight={3} opacity={0.8} />
            {formattedLogs.map((log, idx) => (
                <Marker
                    key={idx}
                    position={[log.lat, log.lng]}
                    icon={createIcon(getMarkerColor(log.status))}
                >
                    <Popup className="obu-popup text-sm font-sans">
                        <div className="font-bold text-gray-800 mb-1">{log.status === 'RUNNING' ? 'Di chuyển' : log.status === 'STOPPED' ? 'Dừng xe' : 'Đỗ xe'}</div>
                        <div className="text-gray-600 text-xs mb-0.5">Vận tốc: {Math.round(log.speed || 0)} km/h</div>
                        <div className="text-gray-500 text-[11px] leading-tight">
                            Báo cáo: {log.date.toLocaleDateString('en-GB')} {log.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    </Popup>
                </Marker>
            ))}
        </>
    );
}

export default function JourneyHistoryPage() {
    const { vehicles, API_BASE_URL } = useVehicles();

    // Initial Dates (last 24h)
    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(new Date(Date.now() - 24 * 60 * 60 * 1000));

    const [selectedImei, setSelectedImei] = useState('');
    const [loading, setLoading] = useState(false);
    const [historicalData, setHistoricalData] = useState([]);
    const [formattedData, setFormattedData] = useState({ logs: [], stats: { totalKm: 0, runningMin: 0, stoppedMin: 0, parkedMin: 0, engineOnMin: 0 } });

    // UI Filters
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, RUNNING, STOPPED, PARKED
    const [hoveredLog, setHoveredLog] = useState(null);

    // Initial select first vehicle
    useEffect(() => {
        if (vehicles.length > 0 && !selectedImei) {
            setSelectedImei(vehicles[0].imei);
        }
    }, [vehicles, selectedImei]);

    const handleSearch = async () => {
        if (!selectedImei) return alert('Vui lòng chọn 1 xe.');

        // Validation: Future dates
        const now = new Date();
        if (startDate > now || endDate > now) {
            return alert('Không được chọn thời gian trong tương lai.');
        }

        // Validation: Duration max 24 hours to save DB resources
        if (endDate.getTime() - startDate.getTime() > 24 * 60 * 60 * 1000) {
            return alert('Chỉ được xem nhật trình tối đa 24 giờ trong 1 lần tra cứu.');
        }

        if (startDate >= endDate) {
            return alert('Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.');
        }

        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/vehicles/${selectedImei}/history`, {
                params: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                }
            });
            const data = res.data.data;
            const apiTotalKm = res.data.totalKm || 0;
            
            setHistoricalData(data);

            const processResult = formatJourneyData(data);

            setFormattedData({
                stats: { ...processResult.stats, totalKm: apiTotalKm },
                logs: processResult.logs
            });

        } catch (error) {
            alert('Lỗi lấy dữ liệu lịch sử');
        } finally {
            setLoading(false);
        }
    };

    // Derived filtered logs
    const filteredLogs = useMemo(() => {
        if (statusFilter === 'ALL') return formattedData.logs;
        if (statusFilter === 'ENGINE_ON') return formattedData.logs.filter(s => s.status === 'RUNNING' || s.status === 'STOPPED');
        if (statusFilter === 'ENGINE_OFF') return formattedData.logs.filter(s => s.status === 'PARKED');
        return formattedData.logs.filter(s => s.status === statusFilter);
    }, [formattedData.logs, statusFilter]);

    return (
        <div className="flex h-screen bg-gray-50 flex-col overflow-hidden">
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar Layout */}
                <div className="w-[550px] bg-white border-r border-gray-200 flex flex-col shrink-0 shadow-sm z-[5]">

                    {/* Header inside Sidebar */}
                    <div className="px-4 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                        <h1 className="text-xl font-bold tracking-tight text-gray-800">Nhật trình xe</h1>
                        <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 h-8 px-3 text-sm font-medium">
                            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                            Xuất file
                        </Button>
                    </div>

                    {/* Filters */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Chọn xe</label>
                                <select
                                    className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                    value={selectedImei}
                                    onChange={(e) => setSelectedImei(e.target.value)}
                                >
                                    <option value="" disabled>-- Chọn một xe --</option>
                                    {vehicles.map(v => (
                                        <option key={v.imei} value={v.imei}>{v.licensePlate || v.imei}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Từ ngày</label>
                                <Input
                                    type="datetime-local"
                                    value={formatDateTimeLocal(startDate)}
                                    onChange={(e) => setStartDate(new Date(e.target.value))}
                                    className="w-full text-xs h-9 px-2"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Đến ngày</label>
                                <Input
                                    type="datetime-local"
                                    value={formatDateTimeLocal(endDate)}
                                    onChange={(e) => setEndDate(new Date(e.target.value))}
                                    className="w-full text-xs h-9 px-2"
                                />
                            </div>
                        </div>
                        <Button variant="primary" onClick={handleSearch} className="w-full h-9 py-0" disabled={loading}>
                            {loading ? 'Đang tải...' : 'Tra cứu'}
                        </Button>
                    </div>

                    {/* Stats - Single Row */}
                    <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-gray-100 bg-white">
                        <div className="bg-blue-50/50 rounded-lg p-2 border border-blue-100 flex flex-col justify-center">
                            <p className="text-[11px] text-gray-500 mb-0.5 font-medium whitespace-nowrap">Thời gian chạy</p>
                            <p className="text-lg font-bold text-gray-800 leading-tight">{Math.floor(formattedData.stats.runningMin / 60)}h{formattedData.stats.runningMin % 60}p</p>
                        </div>
                        <div className="bg-gray-50/50 rounded-lg p-2 border border-gray-100 flex flex-col justify-center">
                            <p className="text-[11px] text-gray-500 mb-0.5 font-medium whitespace-nowrap">Tổng km</p>
                            <p className="text-lg font-bold text-gray-800 leading-tight">{formattedData.stats.totalKm}</p>
                        </div>
                        <div className="bg-gray-50/50 rounded-lg p-2 border border-gray-100 flex flex-col justify-center">
                            <p className="text-[11px] text-gray-500 mb-0.5 font-medium whitespace-nowrap">Dừng/Đỗ</p>
                            <p className="text-lg font-bold text-gray-800 leading-tight">{Math.floor((formattedData.stats.stoppedMin + formattedData.stats.parkedMin) / 60)}h{(formattedData.stats.stoppedMin + formattedData.stats.parkedMin) % 60}p</p>
                        </div>
                        <div className="bg-gray-50/50 rounded-lg p-2 border border-gray-100 flex flex-col justify-center">
                            <p className="text-[11px] text-gray-500 mb-0.5 font-medium whitespace-nowrap">Bật máy</p>
                            <p className="text-lg font-bold text-gray-800 leading-tight">{Math.floor(formattedData.stats.engineOnMin / 60)}h{formattedData.stats.engineOnMin % 60}p</p>
                        </div>
                    </div>

                    {/* Timeline Filters */}
                    <div className="flex gap-2 p-3 border-b border-gray-100 bg-gray-50/50 overflow-x-auto no-scrollbar shrink-0">
                        {[{ v: 'ALL', l: 'Tất cả' }, { v: 'RUNNING', l: 'Đang chạy' }, { v: 'STOPPED', l: 'Dừng xe' }, { v: 'PARKED', l: 'Đỗ xe' }, { v: 'ENGINE_ON', l: 'Nổ máy' }, { v: 'ENGINE_OFF', l: 'Tắt máy' }].map(opt => (
                            <button
                                key={opt.v}
                                onClick={() => setStatusFilter(opt.v)}
                                className={`px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors whitespace-nowrap ${statusFilter === opt.v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                            >
                                {opt.l}
                            </button>
                        ))}
                    </div>

                    {/* Timeline List */}
                    <div className="flex-1 overflow-y-auto w-full max-h-[calc(100vh-471px)]">
                        {filteredLogs.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">Chưa có dữ liệu. Hãy chọn khoảng thời gian và nhấn tra cứu.</div>
                        ) : (
                            <div className="pl-6 pr-4 py-4 w-full">
                                {filteredLogs.map((log, idx) => (
                                    <div
                                        key={idx}
                                        className="relative pl-6 pb-6 cursor-pointer group hover:bg-blue-50/30 w-full"
                                        onClick={() => setHoveredLog(log)}
                                    >
                                        {/* Timeline Line */}
                                        <div className="absolute left-[3px] top-2 bottom-[-10px] w-px bg-gray-200 group-last:bg-transparent" />

                                        {/* Timeline Dot */}
                                        <div className={`absolute left-0 top-1.5 w-2 h-2 rounded-full border border-white ring-2 ring-white
                                            ${log.status === 'RUNNING' ? 'bg-green-500' : log.status === 'STOPPED' ? 'bg-amber-500' : 'bg-gray-400'}
                                        `} />

                                        <div className="flex gap-3 w-full justify-between pr-2 items-center">
                                            <div className="flex flex-col text-right shrink-0 w-[65px] pt-1">
                                                <span className="text-[10px] font-medium text-gray-400 tabular-nums">{log.date.toLocaleDateString('en-GB')}</span>
                                                <span className="text-xs font-bold text-gray-700 tabular-nums">{log.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-gray-800 text-sm mb-1 leading-tight flex items-center justify-between">
                                                    <span>{log.status === 'RUNNING' ? 'Di chuyển' : log.status === 'STOPPED' ? 'Dừng xe' : 'Đỗ xe'}</span>
                                                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1 rounded">{log.lat.toFixed(5)}, {log.lng.toFixed(5)}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 truncate leading-snug flex items-center gap-3">
                                                    <span>RPM: {log.rpm}</span>
                                                    <span>Temp: {log.coolantTemp || 0}°C</span>
                                                    <span>Throttle: {log.throttle || 0}%</span>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-xs font-bold text-gray-700 mb-1 leading-tight">
                                                    {Math.round(log.speed || 0)} km/h
                                                </div>
                                                <div className="text-xs text-gray-400">Fuel {log.fuel || 0}%</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Map View */}
                <div className="flex-1 bg-gray-100 relative">
                    {/* Top Status Legend - Overlaid on Map */}
                    <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 p-2.5 flex gap-4 text-xs font-medium text-gray-700">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> Đang chạy</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div> Dừng xe</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-gray-500"></div> Đỗ xe</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400"></div> Mất tín hiệu</div>
                    </div>

                    <MapContainer center={[21.029754, 105.781992]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; OpenStreetMap contributors'
                        />
                        <JourneyMap formattedLogs={filteredLogs} zoomToLog={hoveredLog} />
                    </MapContainer>
                </div>
            </div>
        </div>
    );
}
