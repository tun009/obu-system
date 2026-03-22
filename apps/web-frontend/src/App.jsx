import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { VehicleProvider } from './context/VehicleContext';
import MainLayout from './layouts/MainLayout';
import MapMonitorPage from './pages/MapMonitorPage';
import VehicleListPage from './pages/VehicleListPage';
import JourneyHistoryPage from './pages/JourneyHistoryPage';

import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';

import './index.css';

// Component bảo vệ các route cần đăng nhập
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return children;
};

function App() {
    return (
        <AuthProvider>
            <VehicleProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                            <Route index element={<Navigate to="/monitor" replace />} />
                            <Route path="monitor" element={<MapMonitorPage />} />
                            <Route path="list" element={<VehicleListPage />} />
                            <Route path="history" element={<JourneyHistoryPage />} />
                        </Route>
                    </Routes>
                </Router>
            </VehicleProvider>
        </AuthProvider>
    );
}

export default App;
