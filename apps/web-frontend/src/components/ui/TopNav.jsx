import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function TopNav() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = () => {
      logout();
      navigate('/login', { replace: true });
  };

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

      <div className="flex items-center gap-4 text-base text-gray-500">
        <div className="flex items-center gap-3 ml-2 pl-4 border-l">
          <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#335ddc]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
              </div>
              <span className="font-semibold text-gray-800 text-sm">Admin</span>
          </div>
          
          <button 
              onClick={handleLogout}
              className="ml-2 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
              title="Đăng xuất"
          >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
