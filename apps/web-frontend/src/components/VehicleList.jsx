import React, { useState } from 'react';
import Badge from './ui/Badge';
import Input from './ui/Input';

export default function VehicleList({ vehicles, onSelectVehicle, selectedVehicleId }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('ALL');

    const stats = {
        total: vehicles.length,
        running: vehicles.filter(v => v.status === 'RUNNING').length,
        stopped: vehicles.filter(v => v.status === 'STOPPED').length,
        parked: vehicles.filter(v => v.status === 'PARKED').length,
        engineOn: vehicles.filter(v => v.status === 'RUNNING' || v.status === 'STOPPED').length,
        engineOff: vehicles.filter(v => v.status === 'PARKED' || v.status === 'LOST_SIGNAL' || v.status === 'OFFLINE').length,
        lost: vehicles.filter(v => v.status === 'LOST_SIGNAL' || v.status === 'OFFLINE').length,
    };

    const filteredVehicles = vehicles
        .filter(v => v.licensePlate?.toLowerCase().includes(searchTerm.toLowerCase()) || v.imei?.includes(searchTerm))
        .filter(v => {
            if (filter === 'ALL') return true;
            if (filter === 'ENGINE_ON') return v.status === 'RUNNING' || v.status === 'STOPPED';
            if (filter === 'ENGINE_OFF') return v.status === 'PARKED' || v.status === 'LOST_SIGNAL' || v.status === 'OFFLINE';
            if (filter === 'LOST_SIGNAL') return v.status === 'LOST_SIGNAL' || v.status === 'OFFLINE';
            return v.status === filter;
        });

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
            <div className="p-5 pb-0">
                <h2 className="text-xl font-bold text-gray-800 tracking-tight">Danh sách đội xe ({vehicles.length})</h2>

                <div className="flex gap-2 mt-4 items-center">
                    <div className="relative flex-1">
                        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm biển số xe, imei,..."
                            className="pl-9 h-10 w-full bg-gray-50 border-gray-200 shadow-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-5 gap-2 mt-4 text-center">
                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 cursor-pointer hover:bg-blue-50" onClick={() => setFilter('ALL')}>
                        <p className="text-[12px] font-semibold text-gray-500">Tổng xe</p>
                        <p className="text-2xl font-bold text-[#335ddc]">{stats.total}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 border border-green-100 cursor-pointer hover:bg-green-100" onClick={() => setFilter('RUNNING')}>
                        <p className="text-[12px] font-semibold text-gray-500 line-clamp-1">Đang chạy</p>
                        <p className="text-2xl font-bold text-green-600">{stats.running}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2 border border-orange-100 cursor-pointer hover:bg-orange-100" onClick={() => setFilter('STOPPED')}>
                        <p className="text-[12px] font-semibold text-gray-500 line-clamp-1">Dừng xe</p>
                        <p className="text-2xl font-bold text-orange-500">{stats.stopped}</p>
                    </div>
                    <div className="bg-gray-100/50 rounded-lg p-2 border border-gray-200 cursor-pointer hover:bg-gray-200" onClick={() => setFilter('PARKED')}>
                        <p className="text-[12px] font-semibold text-gray-500 line-clamp-1">Đỗ xe</p>
                        <p className="text-2xl font-bold text-gray-600">{stats.parked}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 border border-red-100 cursor-pointer hover:bg-red-100" onClick={() => setFilter('LOST_SIGNAL')}>
                        <p className="text-[12px] font-semibold text-gray-500 line-clamp-1">Mất tín hiệu</p>
                        <p className="text-2xl font-bold text-red-500">{stats.lost}</p>
                    </div>
                </div>

                <div className="flex gap-2 mt-4 pb-4 overflow-x-auto no-scrollbar border-b border-gray-100">
                    <button className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border ${filter === 'ALL' ? 'bg-[#335ddc]/10 text-[#335ddc] border-[#335ddc]/30' : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'}`} onClick={() => setFilter('ALL')}>Tất cả</button>
                    <button className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border ${filter === 'RUNNING' ? 'bg-green-100 text-green-700 border-green-300' : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'}`} onClick={() => setFilter('RUNNING')}>Đang chạy</button>
                    <button className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border ${filter === 'STOPPED' ? 'bg-orange-100 text-orange-700 border-orange-300' : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'}`} onClick={() => setFilter('STOPPED')}>Dừng xe</button>
                    <button className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border ${filter === 'PARKED' ? 'bg-gray-200 text-gray-700 border-gray-400' : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'}`} onClick={() => setFilter('PARKED')}>Đỗ xe</button>
                    <button className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border ${filter === 'ENGINE_ON' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'}`} onClick={() => setFilter('ENGINE_ON')}>Nổ máy</button>
                    <button className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border ${filter === 'ENGINE_OFF' ? 'bg-red-100 text-red-700 border-red-300' : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'}`} onClick={() => setFilter('ENGINE_OFF')}>Tắt máy</button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2 px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                <div className="col-span-3">Biển số</div>
                <div className="col-span-2 text-center">Trạng thái</div>
                <div className="text-center ">Km/h</div>
                <div className="text-center">Engine</div>
            </div>

            <div className="flex-1 overflow-y-auto w-full pb-4">
                {filteredVehicles.map((v) => {
                    const isEngineOn = v.status === 'RUNNING' || v.status === 'STOPPED';
                    const lastUpdateStr = v.lastUpdate
                        ? new Date(v.lastUpdate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : '';
                    return (
                    <div
                        key={v.imei}
                        onClick={() => onSelectVehicle(v)}
                        className={`
                            px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors
                            ${selectedVehicleId === v.imei ? 'bg-blue-50 border-l-4 border-l-[#335ddc]' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}
                        `}
                    >
                        <div className="grid grid-cols-7 gap-2 items-center">
                            <div className="col-span-3">
                                <p className="font-bold text-gray-800 text-base line-clamp-1">{v.licensePlate || ''}</p>
                            </div>
                            <div className="col-span-2 flex justify-center">
                                <Badge status={v.status} className="scale-95 origin-center" />
                            </div>
                            <div className="text-center text-base font-semibold text-gray-700">
                                {Math.round(v.speed || 0)}
                            </div>
                            <div className="text-center">
                                <span className={`text-xs font-semibold ${isEngineOn ? 'text-green-700' : 'text-gray-500'}`}>
                                    {isEngineOn ? 'On' : 'Off'}
                                </span>
                            </div>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">
                            {v.lat && v.lng ? `Lat ${Number(v.lat).toFixed(3)}..., Long ${Number(v.lng).toFixed(3)}...` : `IMEI: ${v.imei}`}
                            {lastUpdateStr && <span> · Update {lastUpdateStr}</span>}
                        </p>
                    </div>
                    );
                })}

                {filteredVehicles.length === 0 && (
                    <div className="p-8 text-center bg-gray-50 h-full">
                        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        <p className="text-gray-500 font-medium">Không tìm thấy xe nào phù hợp!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
