import React from 'react';
import { Outlet } from 'react-router-dom';
import TopNav from '../components/ui/TopNav';

export default function MainLayout() {
    return (
        <div className="flex flex-col h-screen w-full bg-[#f3f4f6] font-sans overflow-hidden">
            {/* Nav Region */}
            <TopNav />
            
            {/* Screen Content Switcher via Router */}
            <main className="flex-1 overflow-hidden relative">
                <Outlet />
            </main>
        </div>
    );
}
