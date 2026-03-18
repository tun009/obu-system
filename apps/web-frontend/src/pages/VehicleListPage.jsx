import React, { useState } from 'react';
import axios from 'axios';
import { useVehicles } from '../context/VehicleContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Search, Filter, FileSpreadsheet, Plus, Edit, Trash2 } from 'lucide-react';
import AddVehicleModal from '../components/vehicles/AddVehicleModal';

export default function VehicleListPage() {
    const { vehicles, setVehicles, API_BASE_URL } = useVehicles();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);

    const handleDelete = async (imei) => {
        if (window.confirm('Xóa xe này sẽ xóa TOÀN BỘ dữ liệu nhật trình lịch sử liên quan. Bạn có chắc chắn không?')) {
            try {
                await axios.delete(`${API_BASE_URL}/vehicles/${imei}`);
                setVehicles(prev => prev.filter(v => v.imei !== imei));
            } catch (error) {
                alert('Có lỗi xảy ra khi xóa phương tiện này.');
            }
        }
    };

    const handleEdit = (vehicle) => {
        setEditingVehicle(vehicle);
        setIsAddModalOpen(true);
    };

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filteredVehicles = vehicles.filter(v =>
        v.licensePlate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.imei?.includes(searchTerm)
    );

    // Calc pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredVehicles.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);

    const exportToExcel = () => {
        const statusMap = { RUNNING: 'Đang chạy', STOPPED: 'Dừng (nổ máy)', PARKED: 'Tắt máy', ONLINE: 'Trực tuyến', OFFLINE: 'Ngoại tuyến', LOST_SIGNAL: 'Mất tín hiệu' };
        const headers = ['STT', 'Biển số', 'Loại xe', 'IMEI thiết bị', 'Vận hành'];
        const rows = filteredVehicles.map((v, i) => [
            i + 1, v.licensePlate || '', v.type || '', `\t${v.imei || ''}`,
            statusMap[v.status] || v.status || ''
        ]);
        
        const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `danh_sach_xe_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full bg-[#f3f4f6] p-4 overflow-hidden">
            <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-200 flex flex-col h-full overflow-hidden">
                {/* Header Section */}
                <div className="p-6 pb-4 border-b border-gray-100 flex flex-col gap-4">
                    <h2 className="text-xl font-bold text-gray-800 tracking-tight">Danh sách xe ({filteredVehicles.length})</h2>

                    <div className="flex justify-between items-center gap-4">
                        <div className="flex-1 max-w-lg relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                placeholder="Tìm kiếm biển số xe, emei,..."
                                className="pl-9 h-10 w-full bg-white border-gray-200 focus:ring-2 focus:ring-[#284ba5]/20"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {/* <Button variant="outline" className="h-10 w-10 p-0 flex items-center justify-center text-blue-600 border-gray-200 hover:bg-gray-50 hover:text-[#284ba5] transition-colors shadow-none rounded-lg">
                                <Filter className="w-4 h-4" />
                            </Button> */}
                            <Button variant="outline" onClick={exportToExcel} className="h-10 text-green-700 border-gray-200 bg-white hover:bg-green-50 font-medium transition-colors shadow-none rounded-lg">
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                Xuất file
                            </Button>
                            <Button className="h-10 bg-[#284ba5] hover:bg-[#1e3a8a] text-white font-medium shadow-sm transition-all rounded-lg" onClick={() => { setEditingVehicle(null); setIsAddModalOpen(true); }}>
                                <Plus className="w-4 h-4 mr-1.5" />
                                Thêm mới
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-5 gap-4 px-6 py-3.5 bg-[#f8fafd] border-b border-gray-200 text-[13px] font-semibold text-gray-500 uppercase tracking-wider">
                    <div>Biển số</div>
                    <div>Loại xe</div>
                    <div>IMEI thiết bị</div>
                    <div className="text-center">Vận hành</div>
                    {/* <div className="text-center">Nhiên liệu</div> */}
                    <div className="text-center">Hành động</div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto">
                    {currentItems.map((v, index) => (
                        <div key={v.imei || index} className="grid grid-cols-5 gap-4 px-6 py-3.5 border-b border-gray-100 hover:bg-blue-50/40 transition-colors items-center text-sm group">
                            <div className="font-bold text-gray-800 tracking-tight">{v.licensePlate || ''}</div>
                            <div className="text-gray-500">{v.type || ''}</div>
                            <div className="text-gray-500 font-mono text-xs bg-gray-50 border border-gray-100 px-2 py-1 rounded inline-flex w-fit">{v.imei}</div>
                            <div className="flex justify-center">
                                <Badge status={v.status} className="w-28 justify-center shadow-sm" />
                            </div>
                            {/* <div className={`text-center font-medium ${v.fuel > 80 ? 'text-green-600' : v.fuel > 30 ? 'text-orange-500' : 'text-red-500'}`}>
                                {v.fuel || 0}%
                            </div> */}
                            <div className="flex justify-center gap-3 text-gray-400">
                                <button onClick={() => handleEdit(v)} className="hover:text-blue-600 transition-colors p-1" title="Sửa"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(v.imei)} className="hover:text-red-500 transition-colors p-1" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}

                    {currentItems.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400 bg-gray-50/50">
                            <Search className="w-10 h-10 mb-4 opacity-20" />
                            <p className="font-medium text-gray-500">Không tìm thấy dữ liệu xe phù hợp.</p>
                        </div>
                    )}
                </div>

                {/* Pagination Footer */}
                <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-white">
                    <div className="font-medium">Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredVehicles.length)} out of {filteredVehicles.length} items</div>

                    <div className="flex gap-4 items-center">
                        <div className="flex items-center gap-1 border border-gray-200 rounded px-2 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors bg-white font-medium">
                            <span>10</span>
                            <span className="text-[10px] ml-1">▼</span>
                        </div>
                        <div className="flex gap-1">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="px-2 py-1.5 border border-gray-200 rounded bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-all text-gray-600"
                            >&lt;</button>
                            {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                                const pageNumber = idx + 1; // Simplify for now
                                return (
                                    <button
                                        key={pageNumber}
                                        onClick={() => setCurrentPage(pageNumber)}
                                        className={`min-w-[32px] px-2 py-1.5 border rounded-lg font-medium transition-all ${currentPage === pageNumber ? 'border-[#284ba5] text-white bg-[#284ba5] shadow-sm' : 'border-gray-200 hover:bg-gray-50 text-gray-600 bg-white'}`}
                                    >
                                        {pageNumber}
                                    </button>
                                );
                            })}

                            {totalPages > 5 && <span className="px-2 py-1.5 text-gray-400 font-medium">...</span>}

                            <button
                                disabled={currentPage === totalPages || totalPages === 0}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="px-2 py-1.5 border border-gray-200 rounded bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-all text-gray-600"
                            >&gt;</button>
                        </div>

                        <div className="flex items-center gap-2 font-medium">
                            <span>Go to page</span>
                            <input type="text" className="w-10 h-7 border border-gray-200 rounded text-center focus:ring-1 focus:ring-[#284ba5]/50 focus:border-[#284ba5]/50 outline-none" placeholder="#" />
                            <button className="text-gray-400 hover:text-[#284ba5] transition-colors">→</button>
                        </div>
                    </div>
                </div>
            </div>

            {isAddModalOpen && <AddVehicleModal onClose={() => setIsAddModalOpen(false)} editingVehicle={editingVehicle} />}
        </div>
    );
}
