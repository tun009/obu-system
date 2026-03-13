import React from 'react';

export default function Input({ label, type = 'text', error, className = '', ...props }) {
  return (
    <div className="flex flex-col w-full">
      {label && <label className="mb-1 text-sm font-medium text-gray-700">{label}</label>}
      <input
        type={type}
        className={`px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#284ba5] focus:border-[#284ba5] transition-colors
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-200'}
          ${className}
        `}
        {...props}
      />
      {error && <span className="mt-1 text-xs text-red-500">{error}</span>}
    </div>
  );
}
