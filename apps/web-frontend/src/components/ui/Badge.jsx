import React from 'react';

// Maps backend status string to Vietnamese display text
const statusMap = {
  RUNNING: "Đang chạy",
  STOPPED: "Dừng xe",
  PARKED: "Đỗ xe",
  LOST_SIGNAL: "Mất tín hiệu",
  OFFLINE: "Mất tín hiệu",
  ONLINE: "Trực tuyến"
};

// Maps backend status string to Tailwind classes
const variantMap = {
  RUNNING: "text-[#10b981] border-[#10b981] bg-[#10b981]/10",
  STOPPED: "text-[#f59e0b] border-[#f59e0b] bg-[#f59e0b]/10",
  PARKED: "text-[#64748b] border-[#64748b] bg-[#64748b]/10",
  LOST_SIGNAL: "text-[#ef4444] border-[#ef4444] bg-[#ef4444]/10",
  OFFLINE: "text-[#ef4444] border-[#ef4444] bg-[#ef4444]/10",
  ONLINE: "text-[#3b82f6] border-[#3b82f6] bg-[#3b82f6]/10"
};

export default function Badge({ status, className = '' }) {
    const rawStatus = status || 'ONLINE';
    const text = statusMap[rawStatus] || "Chưa xác định";
    const css = variantMap[rawStatus] || "text-gray-500 border-gray-500 bg-gray-100";

    return (
        <span className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold uppercase tracking-wider border rounded-full ${css} ${className}`}>
            {text}
        </span>
    );
}
