import React, { useState } from 'react';
import axios from 'axios';
import { useVehicles } from '../../context/VehicleContext';
import Button from '../ui/Button';
import Input from '../ui/Input';

export default function AddVehicleModal({ onClose, editingVehicle }) {
    const { setVehicles, API_BASE_URL } = useVehicles();
    const isEditMode = !!editingVehicle;

    const [plate, setPlate] = useState(editingVehicle?.licensePlate || '');
    const [type, setType] = useState(editingVehicle?.type || '');
    const [imei, setImei] = useState(editingVehicle?.imei || '');

    // Status can be 'idle', 'success', 'error'
    const [checkStatus, setCheckStatus] = useState(isEditMode ? 'success' : 'idle');

    const [checkData, setCheckData] = useState(null);

    const handleCheck = async () => {
        if (!imei) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/vehicles/${imei}/check`);
            if (res.data.success) {
                setCheckStatus('success');
                setCheckData(res.data.data);
            } else {
                setCheckStatus('error');
                setCheckData(null);
            }
        } catch (error) {
            setCheckStatus('error');
            setCheckData(null);
        }
    };

    const handleSubmit = async () => {
        try {
            if (isEditMode) {
                await axios.put(`${API_BASE_URL}/vehicles/${editingVehicle.imei}`, { licensePlate: plate, type });
                setVehicles(prev => prev.map(v => v.imei === editingVehicle.imei ? { ...v, licensePlate: plate, type } : v));
            } else {
                const res = await axios.post(`${API_BASE_URL}/vehicles`, { imei, licensePlate: plate, type });
                // If the vehicle doesn't exist yet in the Websocket array, append it manually as OFFLINE
                setVehicles(prev => {
                    const existing = prev.find(v => v.imei === imei);
                    if (existing) return prev;
                    return [{ imei, licensePlate: plate, type, status: 'OFFLINE', speed: 0, rpm: 0, fuel: 0, coolantTemp: 0 }, ...prev];
                });
            }
            onClose();
        } catch (e) {
            alert('Lỗi lưu đối tượng giao thông: ' + e.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-xl shadow-2xl w-[600px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-xl font-bold text-gray-800">{isEditMode ? 'Cập nhật xe' : 'Thêm xe'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 pb-2">
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loại xe <span className="text-red-500">*</span></label>
                            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Nhập loại xe..." className="w-full bg-gray-50/50" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Biển kiểm soát <span className="text-red-500">*</span></label>
                            <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="Nhập biển số..." className="w-full bg-gray-50/50" />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">IMEI thiết bị <span className="text-red-500">*</span></label>
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <Input
                                    value={imei}
                                    onChange={(e) => { setImei(e.target.value); setCheckStatus('idle'); }}
                                    placeholder="Nhập chuỗi IMEI OBU..."
                                    disabled={isEditMode}
                                    className={`w-full font-mono text-sm shadow-inner transition-colors ${isEditMode ? 'bg-gray-100/70 border-gray-200 text-gray-500 cursor-not-allowed' :
                                        checkStatus === 'success' ? 'border-green-500 bg-green-50/30 focus:border-green-600 focus:ring-green-500/20' :
                                            checkStatus === 'error' ? 'border-red-500 bg-red-50/30 focus:border-red-600 focus:ring-red-500/20' :
                                                'bg-gray-50/50'
                                        }`}
                                />
                                {checkStatus === 'success' && !isEditMode && <p className="text-xs text-green-600 font-medium italic mt-1.5 px-0.5">Kết nối thiết bị thành công!</p>}
                                {checkStatus === 'error' && !isEditMode && <p className="text-xs text-red-500 font-medium italic mt-1.5 px-0.5">IMEI không hợp lệ hoặc thiết bị đang off!</p>}
                            </div>
                            {!isEditMode && (
                                <Button variant="primary" onClick={handleCheck} className="h-10 px-5 shadow-sm font-medium">
                                    Kiểm tra
                                </Button>
                            )}
                        </div>
                    </div>

                    {checkStatus === 'success' && !isEditMode && checkData && (
                        <div className="mb-4 bg-green-50/50 border border-green-100 p-4 rounded-lg text-sm text-gray-700">
                            <p className="font-semibold text-gray-800 mb-2">Thông tin thiết bị từ hệ thống:</p>
                            <ul className="list-disc pl-5 space-y-1 text-gray-600">
                                <li>GPS: <span className="font-mono text-xs">Lat {checkData.lat.toFixed(5)} - Long {checkData.lng.toFixed(5)}</span></li>
                                <li>Vận tốc: <span className="font-medium text-gray-800">{Math.round(checkData.speed || 0)} km/h</span></li>
                                <li>Cập nhật cuối: <span className="text-gray-800 font-medium">{new Date(checkData.lastUpdate).toLocaleTimeString()}</span></li>
                                <li>Tình trạng: <span className="text-green-600 font-medium">Đang đổ dữ liệu ổn định</span></li>
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
                    <Button variant="outline" onClick={onClose} className="border-gray-200 text-gray-600 bg-white hover:bg-gray-50 px-6 font-medium shadow-none transition-colors">
                        Huỷ
                    </Button>
                    <Button variant="primary" onClick={handleSubmit} className="px-6 shadow-sm transition-colors">
                        {isEditMode ? 'Cập nhật' : 'Tạo mới'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
