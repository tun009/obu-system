import React from 'react';
import { NavLink } from 'react-router-dom';

export default function TopNav() {
  const tabs = [
    {
      id: '/monitor', label: 'Giám sát xe', icon: (
        <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
      )
    },
    { id: '/history', label: 'Nhật trình', icon: null },
    { id: '/list', label: 'Danh sách xe', icon: null },
  ];

  return (
    <div className="bg-white border-b border-gray-200 flex items-center justify-between px-6 h-16">
      {/* Left items - Tabs */}
      <div className="flex h-full">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.id}
            className={({ isActive }) => `flex items-center px-4 h-full font-medium text-xl transition-colors border-b-2
              ${isActive
                ? 'text-[#335ddc] border-[#335ddc]'
                : 'text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            {tab.icon && tab.icon}
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Right items - Profile & Controls */}
      <div className="flex items-center gap-4 text-base text-gray-500">
        <div className="flex items-center gap-1 cursor-pointer hover:text-gray-800">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          Support
        </div>
        <div className="flex items-center gap-1 cursor-pointer hover:text-gray-800">
          English
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
        <div className="flex items-center gap-2 cursor-pointer hover:text-gray-800 ml-2 pl-4 border-l">
          <div className="w-6 h-6 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
          </div>
          <span className="font-medium text-gray-700">Admin</span>
        </div>
      </div>
    </div>
  );
}
