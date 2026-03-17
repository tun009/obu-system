import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useVehicles } from '../context/VehicleContext';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { FileSpreadsheet, Play, Pause, FastForward, SkipBack, SkipForward } from 'lucide-react';
import { formatJourneyData } from '../utils/journeyFormatter';
import ReactDOMServer from 'react-dom/server';
import CarIcon from '../components/ui/CarIcon';
import DatePicker from 'react-datepicker';

// Format Date to YYYY-MM-DDTHH:mm string for datetime-local input
const formatDateTimeLocal = (date) => {
    return (new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString()).slice(0, 16);
};

const StaticRoute = React.memo(function StaticRoute({ formattedLogs }) {
    const polylinePositions = useMemo(() => {
        return (formattedLogs || [])
            .filter(p => p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng))
            .map(p => [p.lat, p.lng]);
    }, [formattedLogs]);

    const { startLog, endLog } = useMemo(() => {
        const validLogs = (formattedLogs || []).filter(log => log.lat != null && log.lng != null && !isNaN(log.lat) && !isNaN(log.lng));
        return {
            startLog: validLogs.length > 0 ? validLogs[0] : null,
            endLog: validLogs.length > 0 ? validLogs[validLogs.length - 1] : null
        };
    }, [formattedLogs]);

    const startIcon = useMemo(() => L.divIcon({
        className: 'custom-label-marker',
        html: `<div style="background-color: #22c55e; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 500;">S</div>`,
        iconSize: [24, 24], iconAnchor: [12, 12]
    }), []);

    const endIcon = useMemo(() => L.divIcon({
        className: 'custom-label-marker',
        html: `<div style="background-color: #ef4444; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 500;">E</div>`,
        iconSize: [24, 24], iconAnchor: [12, 12]
    }), []);

    return (
        <>
            {polylinePositions.length > 0 && (
                <Polyline positions={polylinePositions} color="#3b82f6" weight={4} opacity={0.8} />
            )}

            {startLog && (
                <Marker position={[startLog.lat, startLog.lng]} icon={startIcon} zIndexOffset={800}>
                    <Popup className="obu-popup text-sm font-sans">
                        <div className="font-bold text-gray-800 mb-1">Điểm xuất phát</div>
                        <div className="text-gray-500 text-[11px] leading-tight flex flex-col gap-1">
                            <span>Thời gian: {startLog.date.toLocaleDateString('en-GB')} {startLog.date.toLocaleTimeString('en-GB')}</span>
                        </div>
                    </Popup>
                </Marker>
            )}

            {endLog && startLog !== endLog && (
                <Marker position={[endLog.lat, endLog.lng]} icon={endIcon} zIndexOffset={800}>
                    <Popup className="obu-popup text-sm font-sans">
                        <div className="font-bold text-gray-800 mb-1">Điểm kết thúc</div>
                        <div className="text-gray-500 text-[11px] leading-tight flex flex-col gap-1">
                            <span>Thời gian: {endLog.date.toLocaleDateString('en-GB')} {endLog.date.toLocaleTimeString('en-GB')}</span>
                        </div>
                    </Popup>
                </Marker>
            )}
        </>
    );
});

function MapPanner({ formattedLogs, zoomToLog }) {
    const map = useMap();
    const isInitialized = useRef(false);

    useEffect(() => {
        if (formattedLogs && formattedLogs.length > 0) {
            const validPoints = formattedLogs.filter(p => p.lat && p.lng);
            if (validPoints.length > 0) {
                const bounds = L.latLngBounds(validPoints.map(s => [s.lat, s.lng]));
                map.fitBounds(bounds, { padding: [50, 50] });
                isInitialized.current = true;
            }
        }
    }, [formattedLogs, map]);

    useEffect(() => {
        if (zoomToLog && zoomToLog.lat != null && zoomToLog.lng != null) {
            map.panTo([zoomToLog.lat, zoomToLog.lng], { animate: true, duration: 0.25 });
        }
    }, [zoomToLog, map]);

    return null;
}

function CarCursor({ zoomToLog }) {
    const createCarMarker = (status, direction = 0) => {
        const rawSvg = ReactDOMServer.renderToString(<CarIcon status={status} width={24} height={40} />);
        return L.divIcon({
            className: 'custom-car-marker',
            html: `<div style="transform: rotate(${direction}deg); transform-origin: center center; transition: transform 0.3s ease-out;">${rawSvg}</div>`,
            iconSize: [24, 40],
            iconAnchor: [12, 20],
            popupAnchor: [0, -20]
        });
    };

    if (!zoomToLog || zoomToLog.lat == null || zoomToLog.lng == null || isNaN(zoomToLog.lat) || isNaN(zoomToLog.lng)) {
        return null;
    }

    return (
        <Marker
            position={[zoomToLog.lat, zoomToLog.lng]}
            icon={createCarMarker(zoomToLog.status, zoomToLog.direction)}
            zIndexOffset={1000}
        >
            <Popup className="obu-popup text-sm font-sans" autoPan={false}>
                <div className="font-bold text-gray-800 mb-1">{zoomToLog.status === 'RUNNING' ? 'Đang chạy' : zoomToLog.status === 'STOPPED' ? 'Dừng xe' : 'Đỗ xe'}</div>
                <div className="text-gray-600 text-xs mb-0.5">Vận tốc: {Math.round(zoomToLog.speed || 0)} km/h</div>
                <div className="text-gray-500 text-[11px] leading-tight">
                    Báo cáo: {zoomToLog.date.toLocaleDateString('en-GB')} {zoomToLog.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
            </Popup>
        </Marker>
    );
}

function JourneyMap({ formattedLogs, zoomToLog }) {
    return (
        <>
            <StaticRoute formattedLogs={formattedLogs} />
            <MapPanner formattedLogs={formattedLogs} zoomToLog={zoomToLog} />
            <CarCursor zoomToLog={zoomToLog} />
        </>
    );
}

export default function JourneyHistoryPage() {
    const { vehicles, API_BASE_URL } = useVehicles();

    // Initial Dates (last 1h)
    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(new Date(Date.now() - 1 * 60 * 60 * 1000));

    const [selectedImei, setSelectedImei] = useState('');
    const [loading, setLoading] = useState(false);
    const [historicalData, setHistoricalData] = useState([]);
    const [formattedData, setFormattedData] = useState({ logs: [], stats: { totalKm: 0, runningMin: 0, stoppedMin: 0, parkedMin: 0, engineOnMin: 0 } });

    // UI Filters
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, RUNNING, STOPPED, PARKED
    const [hoveredLog, setHoveredLog] = useState(null);

    // #8: Lazy load — chỉ render visibleCount dòng, tăng khi scroll tới cuối
    const LOAD_STEP = 100;
    const [visibleCount, setVisibleCount] = useState(LOAD_STEP);
    const sentinelRef = useRef(null);

    // Playback State
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackIndex, setPlaybackIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 5x, 10x

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

    // #8: Reset visibleCount mỗi khi filteredLogs thay đổi (search mới)
    useEffect(() => { setVisibleCount(LOAD_STEP); }, [filteredLogs]);

    // #8: IntersectionObserver — load thêm khi sentinel hậu hiện trong viewport
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount(prev => Math.min(prev + LOAD_STEP, filteredLogs.length));
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [filteredLogs.length, visibleCount]);

    const visibleLogs = filteredLogs.slice(0, visibleCount);

    // Playback Effect Loop
    useEffect(() => {
        let interval;
        if (isPlaying && filteredLogs.length > 0) {
            const baseInterval = 1000; // 1 second real-time per point (assuming 1 log per sec)
            interval = setInterval(() => {
                setPlaybackIndex((prev) => {
                    if (prev >= filteredLogs.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    const nextIndex = prev + 1;
                    setHoveredLog(filteredLogs[nextIndex]);
                    return nextIndex;
                });
            }, baseInterval / playbackSpeed);
        }
        return () => clearInterval(interval);
    }, [isPlaying, playbackSpeed, filteredLogs]);

    // Handlers for manual playback scrub
    const handleScrub = (e) => {
        const val = parseInt(e.target.value, 10);
        setPlaybackIndex(val);
        setHoveredLog(filteredLogs[val]);
    };

    const togglePlay = () => {
        if (playbackIndex >= filteredLogs.length - 1) {
            // Restart if at end
            setPlaybackIndex(0);
            setHoveredLog(filteredLogs[0]);
        }
        setIsPlaying(!isPlaying);
    };

    const cycleSpeed = () => {
        const speeds = [1, 2, 5, 10];
        const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
        setPlaybackSpeed(nextSpeed);
    };



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
                        <div className="bg-blue-50/50 rounded-lg p-2 border border-blue-100 flex flex-col justify-center">
                            <p className="text-[11px] text-gray-500 mb-0.5 font-medium whitespace-nowrap">Tổng km</p>
                            <p className="text-lg font-bold text-gray-800 leading-tight">{formattedData.stats.totalKm}</p>
                        </div>
                        <div className="bg-blue-50/50 rounded-lg p-2 border border-blue-100 flex flex-col justify-center">
                            <p className="text-[11px] text-gray-500 mb-0.5 font-medium whitespace-nowrap">Dừng/Đỗ</p>
                            <p className="text-lg font-bold text-gray-800 leading-tight">{Math.floor((formattedData.stats.stoppedMin + formattedData.stats.parkedMin) / 60)}h{(formattedData.stats.stoppedMin + formattedData.stats.parkedMin) % 60}p</p>
                        </div>
                        <div className="bg-blue-50/50 rounded-lg p-2 border border-blue-100 flex flex-col justify-center">
                            <p className="text-[11px] text-gray-500 mb-0.5 font-medium whitespace-nowrap">Bật máy</p>
                            <p className="text-lg font-bold text-gray-800 leading-tight">{Math.floor(formattedData.stats.engineOnMin / 60)}h{formattedData.stats.engineOnMin % 60}p</p>
                        </div>
                    </div>

                    {/* Timeline Filters */}
                    {/* <div className="flex gap-2 p-3 border-b border-gray-100 bg-gray-50/50 overflow-x-auto no-scrollbar shrink-0">
                        {[{ v: 'ALL', l: 'Tất cả' }, { v: 'RUNNING', l: 'Đang chạy' }, { v: 'STOPPED', l: 'Dừng xe' }, { v: 'PARKED', l: 'Đỗ xe' }].map(opt => (
                            <button
                                key={opt.v}
                                onClick={() => setStatusFilter(opt.v)}
                                className={`px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors whitespace-nowrap ${statusFilter === opt.v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                            >
                                {opt.l}
                            </button>
                        ))}
                    </div> */}

                    {/* Timeline List */}
                    <div className="flex-1 overflow-y-auto w-full max-h-[calc(100vh-421px)]">
                        {filteredLogs.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">Chưa có dữ liệu. Hãy chọn khoảng thời gian và nhấn tra cứu.</div>
                        ) : (
                            <div className="pl-6 pr-4 py-4 w-full">
                                {/* #8: Chỉ render visibleLogs, không render toàn bộ */}
                                {visibleLogs.map((log, idx) => (
                                    <div
                                        key={idx}
                                        className={`relative pl-6 pb-6 cursor-pointer group w-full ${hoveredLog === log ? 'bg-blue-50/50' : 'hover:bg-blue-50/30'}`}
                                        onClick={() => {
                                            setHoveredLog(log);
                                            setPlaybackIndex(idx);
                                        }}
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
                                                    <span>{log.status === 'RUNNING' ? 'Đang chạy' : log.status === 'STOPPED' ? 'Dừng xe' : 'Đỗ xe'}</span>
                                                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1 rounded">
                                                        {log.validLocation && log.lat != null && log.lng != null ? `${log.lat.toFixed(5)}, ${log.lng.toFixed(5)}` : 'Mất GPS'}
                                                    </span>
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
                                {/* #8: Sentinel div — IntersectionObserver theo dõi để load thêm */}
                                {visibleCount < filteredLogs.length && (
                                    <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                                        <span className="text-xs text-gray-400">Đang tải thêm...</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Map View */}
                <div className="flex-1 bg-gray-100 relative">
                    {/* Top Status Legend - Overlaid on Map */}
                    <div className="absolute top-4 left-12 z-[400] bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 p-2.5 flex gap-4 text-xs font-medium text-gray-700">
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

                    {/* Floating Playback Widget */}
                    {filteredLogs.length > 0 && (
                        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[500] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.14)] border border-gray-100 px-5 py-3 flex items-center gap-4 w-[480px]">
                            {/* Play/Pause Button */}
                            <button
                                onClick={togglePlay}
                                className="w-10 h-10 rounded-full bg-[#335ddc] hover:bg-[#2749c0] text-white flex items-center justify-center shrink-0 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-[#335ddc]/40"
                            >
                                {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 translate-x-[2px]" fill="currentColor" />}
                            </button>

                            {/* Scrubber & Info */}
                            <div className="flex-1 flex flex-col gap-2 min-w-0">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-semibold text-gray-400 tabular-nums">
                                        {formatDateTimeLocal(filteredLogs[0].date).replace('T', ' ')}
                                    </span>
                                    {hoveredLog && (
                                        <span className="text-[11px] font-bold text-[#335ddc] bg-[#335ddc]/8 px-2 py-0.5 rounded-full tabular-nums">
                                            ▶ {hoveredLog.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    )}
                                    <span className="text-[10px] font-semibold text-gray-400 tabular-nums">
                                        {formatDateTimeLocal(filteredLogs[filteredLogs.length - 1].date).replace('T', ' ')}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max={filteredLogs.length - 1}
                                    value={playbackIndex}
                                    onChange={handleScrub}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#335ddc] focus:outline-none"
                                    style={{
                                        background: `linear-gradient(to right, #335ddc ${(playbackIndex / (filteredLogs.length - 1)) * 100}%, #e5e7eb ${(playbackIndex / (filteredLogs.length - 1)) * 100}%)`
                                    }}
                                />
                            </div>

                            {/* Speed Control */}
                            <button
                                onClick={cycleSpeed}
                                className="w-9 h-9 shrink-0 flex items-center justify-center text-xs font-bold text-[#335ddc] bg-[#335ddc]/8 hover:bg-[#335ddc]/15 rounded-full transition-colors border border-[#335ddc]/20 focus:outline-none"
                            >
                                {playbackSpeed}x
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
