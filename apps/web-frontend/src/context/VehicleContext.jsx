import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const VehicleContext = createContext();

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL   = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function VehicleProvider({ children }) {
    const [vehicles, setVehicles] = useState([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const fetchVehicles = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/vehicles`);
                if (response.data.success) {
                    setVehicles(response.data.data);
                }
            } catch (error) {
                console.error("Failed to load initial vehicles", error);
            }
        };
        fetchVehicles();
    }, []);

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });

        socket.on('connect',       () => { console.log("WS: Connected"); setIsConnected(true); });
        socket.on('disconnect',    () => { console.warn("WS: Disconnected"); setIsConnected(false); });
        socket.on('connect_error', () => { console.error("WS: Connection error"); setIsConnected(false); });
        socket.on('reconnect',     () => { console.log("WS: Reconnected"); setIsConnected(true); });

        socket.on('vehicle_moved', (incomingData) => {
            setVehicles(prevVehicles => {
                const index = prevVehicles.findIndex(v => v.imei === incomingData.imei);
                if (index !== -1) {
                    const updated = [...prevVehicles];
                    updated[index] = {
                        ...updated[index],
                        lat: incomingData.lat,
                        lng: incomingData.lng,
                        speed: incomingData.speed,
                        rpm: incomingData.rpm,
                        fuel: incomingData.fuel,
                        status: incomingData.status,
                        coolantTemp: incomingData.coolantTemp,
                        throttle: incomingData.throttle,
                        direction: incomingData.direction,
                        lastUpdate: Date.now()
                    };
                    return updated;
                }
                return [...prevVehicles, {
                    id: Date.now(),
                    imei: incomingData.imei,
                    licensePlate: `Xe ${incomingData.imei.slice(-4)}`,
                    lat: incomingData.lat,
                    lng: incomingData.lng,
                    speed: incomingData.speed,
                    rpm: incomingData.rpm,
                    fuel: incomingData.fuel,
                    status: incomingData.status,
                    coolantTemp: incomingData.coolantTemp,
                    throttle: incomingData.throttle,
                    direction: incomingData.direction,
                    lastUpdate: Date.now()
                }];
            });
        });

        return () => socket.disconnect();
    }, []);

    return (
        <VehicleContext.Provider value={{ vehicles, setVehicles, API_BASE_URL, isConnected }}>
            {children}
        </VehicleContext.Provider>
    );
}

export function useVehicles() {
    return useContext(VehicleContext);
}
