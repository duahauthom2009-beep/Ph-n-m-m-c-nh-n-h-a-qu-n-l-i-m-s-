
import React, { useState } from 'react';

interface LoginProps {
  onLogin: (name: string, className: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && className.trim()) {
      onLogin(name, className);
    }
  };

  return (
    <div className="min-h-screen bg-study-gradient flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-study-gradient rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Hurricane AI</h1>
          <p className="text-slate-400 font-medium mt-2">Nâng tầm kiến thức, bứt phá giới hạn 🌪️</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tên học sinh</label>
            <input
              type="text"
              required
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-700 shadow-inner"
              placeholder="Nhập họ và tên..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Lớp</label>
            <input
              type="text"
              required
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-700 shadow-inner"
              placeholder="VD: 10A1..."
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full py-5 bg-study-gradient text-white font-black rounded-2xl shadow-xl hover:shadow-blue-500/40 active:scale-95 transition-all text-lg tracking-wider flex items-center justify-center gap-2"
          >
            BẮT ĐẦU <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
