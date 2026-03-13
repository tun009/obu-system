import React from 'react';

export default function Button({ children, onClick, type = 'button', variant = 'primary', className = '', ...props }) {
  const baseStyle = "inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-[#284ba5] hover:bg-[#1e3a8a] text-white shadow-sm",
    outline: "border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-sm",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
