import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';

export default function TopNav() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleLogout = () => {
      logout();
      navigate('/login', { replace: true });
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setIsLangOpen(false);
  };

  const tabs = [
    {
      id: '/monitor', label: t('nav.monitor'), icon: (
        <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
      )
    },
    { id: '/history', label: t('nav.history'), icon: null },
    { id: '/list', label: t('nav.list'), icon: null },
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
        <div className="flex items-center gap-3 ml-2 pl-4">
          <div className="relative mx-3" ref={langRef}>
            <button 
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-[#335ddc] hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-all border border-gray-200 shadow-sm"
            >
              <Globe className="w-4 h-4 text-[#335ddc]" />
              <span className="uppercase">{i18n.language === 'vi' ? 'VI' : 'EN'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLangOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-gray-100 py-1.5 z-[9999] overflow-hidden transform origin-top-right animate-in fade-in zoom-in-95 duration-100">
                <button 
                  onClick={() => changeLanguage('vi')}
                  className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors hover:bg-gray-50 ${i18n.language === 'vi' ? 'text-[#335ddc] font-semibold bg-blue-50/30' : 'text-gray-600'}`}
                >
                  <span>Tiếng Việt</span>
                  {i18n.language === 'vi' && <svg className="w-4 h-4 text-[#335ddc]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                </button>
                <button 
                  onClick={() => changeLanguage('en')}
                  className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors hover:bg-gray-50 ${i18n.language === 'en' ? 'text-[#335ddc] font-semibold bg-blue-50/30' : 'text-gray-600'}`}
                >
                  <span>English</span>
                  {i18n.language === 'en' && <svg className="w-4 h-4 text-[#335ddc]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#335ddc]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
              </div>
              <span className="font-semibold text-gray-800 text-sm">{t('common.admin')}</span>
          </div>
          
          <button 
              onClick={handleLogout}
              className="ml-2 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
              title={t('nav.logout')}
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
