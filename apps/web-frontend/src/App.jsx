import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { VehicleProvider } from './context/VehicleContext';
import MainLayout from './layouts/MainLayout';
import MapMonitorPage from './pages/MapMonitorPage';
import VehicleListPage from './pages/VehicleListPage';
import JourneyHistoryPage from './pages/JourneyHistoryPage';

import './index.css';

function App() {
    return (
        <VehicleProvider>
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
