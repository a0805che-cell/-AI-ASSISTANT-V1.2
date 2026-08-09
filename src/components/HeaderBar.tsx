import React from 'react';
import { ShieldCheck, LogOut, Key, Lock } from 'lucide-react';
import { SystemConfig } from '../types';

interface HeaderBarProps {
  activeMainTab: 'student' | 'teacher';
  config: SystemConfig;
  isTeacherAuthenticated?: boolean;
  onRequestTeacherLogin?: () => void;
  onTeacherLogout?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeMainTab,
  config,
  isTeacherAuthenticated = false,
  onRequestTeacherLogin,
  onTeacherLogout
}) => {
  return (
    <header className="h-16 bg-white/90 border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
      {/* Page Title & Status Badge */}
      <div className="flex items-center gap-3">
        {activeMainTab === 'teacher' && (
          <span className="bg-[#10b981] text-white text-[10px] font-bold px-2.5 py-1 rounded-lg tracking-wider uppercase shadow-sm">
            FIREBASE CONNECTED
          </span>
        )}
        <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
          {activeMainTab === 'student' ? '學生作業區' : '老師管理中心'}
        </h2>
        {activeMainTab === 'teacher' && (
          <span className="hidden md:inline text-xs text-slate-500 font-medium">
            即時分析學生迷思概念與班級學習成效
          </span>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {activeMainTab === 'teacher' ? (
          <button
            onClick={() => {
              if (onTeacherLogout) {
                onTeacherLogout();
              } else {
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-600" />
            <span>登出管理中心</span>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (onRequestTeacherLogin) onRequestTeacherLogin();
              }}
              className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>老師管理登入</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-[#f1f5f9] px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>AI 信度評算雙重鎖定</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};


