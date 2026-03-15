import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { VehicleProvider } from './context/VehicleContext';
import { useVehicles } from './context/VehicleContext';
import MainLayout from './layouts/MainLayout';
import MapMonitorPage from './pages/MapMonitorPage';
import VehicleListPage from './pages/VehicleListPage';
import JourneyHistoryPage from './pages/JourneyHistoryPage';

import './index.css';

// // #10: Banner cảnh báo mất kết nối WebSocket
// function ConnectionBanner() {
//     const { isConnected } = useVehicles();
//     if (isConnected) return null;
//     return (
//         <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-500 text-white text-xs font-semibold text-center py-1.5 flex items-center justify-center gap-2 animate-pulse">
//             <span>⚠</span>
//             <span>Mất kết nối máy chủ — dữ liệu có thể không được cập nhật. Đang thử kết nối lại...</span>
//         </div>
//     );
// }

function App() {
    return (
        <VehicleProvider>
            {/* <ConnectionBanner /> */}
            <Router>
                <Routes>
                    <Route path="/" element={<MainLayout />}>
                        <Route index element={<Navigate to="/monitor" replace />} />
                        <Route path="monitor" element={<MapMonitorPage />} />
                        <Route path="list" element={<VehicleListPage />} />
                        <Route path="history" element={<JourneyHistoryPage />} />
                    </Route>
                </Routes>
            </Router>
        </VehicleProvider>
    );
}

export default App;
