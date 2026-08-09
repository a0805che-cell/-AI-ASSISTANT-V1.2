import React, { useState } from 'react';
import { ShieldCheck, Lock, Key, ArrowRight, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TeacherLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  teacherPassword?: string;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  teacherPassword = 'bio1234',
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showDefaultHint, setShowDefaultHint] = useState(false);

  if (!isOpen) return null;

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === teacherPassword) {
      setErrorMsg('');
      setPasswordInput('');
      onLoginSuccess();
    } else {
      setErrorMsg(`密碼錯誤！預設密碼為：${teacherPassword}`);
    }
  };

  const handleQuickFillDefault = () => {
    setPasswordInput(teacherPassword);
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl transition-all">
        {/* Modal Header */}
        <div className="bg-[#0f172a] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-[#10b981] flex items-center justify-center text-white shadow-md shadow-emerald-950/50">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">老師管理中心登入</h3>
              <p className="text-xs text-slate-400">Teacher Administration Portal</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mt-2">
            此專區包含全班作業評改紀錄、迷思概念分析與知識庫設定，請輸入導師登入密碼。
          </p>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                管理中心密碼 (Password):
              </label>
              <button
                type="button"
                onClick={handleQuickFillDefault}
                className="text-[11px] font-bold text-[#10b981] hover:text-[#059669] hover:underline flex items-center gap-1 transition-colors"
              >
                <Key className="w-3 h-3" />
                帶入預設密碼 ({teacherPassword})
              </button>
            </div>

            <div className="relative">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="請輸入密碼 (預設: bio1234)"
                autoFocus
                className="w-full bg-[#f8fafc] border border-slate-300 rounded-2xl px-4 py-3 pl-10 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#10b981] font-mono tracking-wider"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          {/* Default password callout banner */}
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <span className="font-bold">預設登入密碼：</span>
              <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-300 font-mono text-emerald-800 font-bold ml-1 mr-1">
                {teacherPassword}
              </code>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                可於「系統設定與 RAG」專區隨時修改登入密碼。
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
            >
              <span>確認登入</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
