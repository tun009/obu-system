import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        
        if (!username || !password) {
            setError('Vui lòng nhập tài khoản và mật khẩu.');
            return;
        }

        const success = login(username, password);
        if (success) {
            navigate('/monitor', { replace: true });
        } else {
            setError('Tài khoản hoặc mật khẩu không chính xác.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div className="text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 overflow-hidden">
                        <img src="/favicon.png" alt="OBU Logo" className="w-10 h-10 object-contain" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">OBU Fleet Tracker</h2>
                    <p className="mt-2 text-sm text-gray-500">Đăng nhập để vào hệ thống giám sát</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tài khoản</label>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#335ddc] focus:border-[#335ddc] focus:z-10 sm:text-sm transition-colors"
                                placeholder="Nhập admin"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#335ddc] focus:border-[#335ddc] focus:z-10 sm:text-sm transition-colors"
                                placeholder="Nhập admin"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-start">
                            <svg className="w-5 h-5 mr-2 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <div>
                        <Button 
                            type="submit" 
                            className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all"
                        >
                            Đăng nhập
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
