import React from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  FileCheck,
  Brain,
  Settings,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  BookOpen,
  Lock
} from 'lucide-react';
import { SystemConfig } from '../types';

interface SidebarProps {
  activeMainTab: 'student' | 'teacher';
  setActiveMainTab: (tab: 'student' | 'teacher') => void;
  activeTeacherSubTab: 'results' | 'misconceptions' | 'settings';
  setActiveTeacherSubTab: (tab: 'results' | 'misconceptions' | 'settings') => void;
  config: SystemConfig;
  totalResultsCount: number;
  totalKnowledgeUnitsCount: number;
  isTeacherAuthenticated?: boolean;
  onRequestTeacherLogin?: (subTab?: 'results' | 'misconceptions' | 'settings') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeMainTab,
  setActiveMainTab,
  activeTeacherSubTab,
  setActiveTeacherSubTab,
  config,
  totalResultsCount,
  totalKnowledgeUnitsCount,
  isTeacherAuthenticated = false,
  onRequestTeacherLogin
}) => {
  const handleTeacherTabClick = (subTab?: 'results' | 'misconceptions' | 'settings') => {
    if (!isTeacherAuthenticated && onRequestTeacherLogin) {
      onRequestTeacherLogin(subTab || activeTeacherSubTab);
    } else {
      setActiveMainTab('teacher');
      if (subTab) setActiveTeacherSubTab(subTab);
    }
  };

  return (
    <aside className="w-64 sm:w-72 bg-[#0f172a] text-slate-100 flex flex-col justify-between shrink-0 select-none min-h-screen border-r border-slate-800/80">
      {/* Brand Header */}
      <div>
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#10b981] flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-950/50">
              B
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                作業評改系統
              </h1>
              <p className="text-[11px] text-slate-400 font-mono tracking-wider">AI ASSISTANT V1.2</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-4 space-y-3 mt-2">
          {/* Main Link 1: Student Area */}
          <button
            onClick={() => setActiveMainTab('student')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
              activeMainTab === 'student'
                ? 'bg-[#10b981] text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 shrink-0" />
              <span>學生作業區</span>
            </div>
            {activeMainTab === 'student' && (
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            )}
          </button>

          {/* Main Link 2: Teacher Management Center */}
          <button
            onClick={() => handleTeacherTabClick()}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
              activeMainTab === 'teacher'
                ? 'bg-[#10b981] text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span>老師管理中心</span>
            </div>
            {activeMainTab === 'teacher' ? (
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            ) : !isTeacherAuthenticated ? (
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                需密碼
              </span>
            ) : (
              <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-700">
                {totalResultsCount}
              </span>
            )}
          </button>

          {/* Teacher Sub-navigation */}
          {activeMainTab === 'teacher' && (
            <div className="ml-4 pl-3 border-l-2 border-emerald-500/30 space-y-1 pt-1 pb-1">
              <button
                onClick={() => handleTeacherTabClick('results')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                  activeTeacherSubTab === 'results'
                    ? 'bg-slate-800 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>評改結果</span>
              </button>

              <button
                onClick={() => handleTeacherTabClick('misconceptions')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                  activeTeacherSubTab === 'misconceptions'
                    ? 'bg-slate-800 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>迷思概念分析</span>
              </button>

              <button
                onClick={() => handleTeacherTabClick('settings')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                  activeTeacherSubTab === 'settings'
                    ? 'bg-slate-800 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>系統設定與 RAG</span>
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* Footer info matching screenshot */}
      <div className="p-6 border-t border-slate-800/60 text-[11px] text-slate-500 space-y-1">
        <p className="font-semibold text-slate-400">© 2024 BIOLOGY AI LAB</p>
        <p className="text-[10px]">Empowering educators with AI</p>
      </div>
    </aside>
  );
};

