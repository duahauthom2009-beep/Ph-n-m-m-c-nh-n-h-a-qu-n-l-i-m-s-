
import React, { useState } from 'react';
import { GRADED_SUBJECTS, PASS_FAIL_SUBJECTS } from '../constants';

interface SubjectSelectorProps {
  onComplete: (selected: { name: string; type: 'graded' | 'pass-fail' }[]) => void;
}

const SubjectSelector: React.FC<SubjectSelectorProps> = ({ onComplete }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set([...GRADED_SUBJECTS.slice(0, 8), ...PASS_FAIL_SUBJECTS]));

  const toggleSubject = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const handleSubmit = () => {
    const result = Array.from(selected).map((name: string) => ({
      name,
      type: (GRADED_SUBJECTS as string[]).includes(name) ? 'graded' as const : 'pass-fail' as const
    }));
    onComplete(result);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 p-10 w-full max-w-3xl animate-in fade-in zoom-in duration-500 border border-slate-100">
        <div className="mb-10 text-center">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Cá nhân hóa lộ trình</h2>
          <p className="text-slate-400 font-medium mt-3 text-lg">Chọn các môn học bạn đang học để bắt đầu quản lý</p>
        </div>

        <div className="space-y-10 max-h-[55vh] overflow-y-auto px-4 custom-scrollbar">
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-black">1</span>
              <h3 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em]">Môn học tính điểm số</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {GRADED_SUBJECTS.map(name => (
                <button
                  key={name}
                  onClick={() => toggleSubject(name)}
                  className={`px-5 py-4 rounded-[1.25rem] border-2 transition-all text-sm font-extrabold tracking-tight ${
                    selected.has(name) 
                    ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-lg shadow-blue-500/10' 
                    : 'border-slate-50 bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-black">2</span>
              <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">Môn học đánh giá (Đạt/CĐ)</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {PASS_FAIL_SUBJECTS.map(name => (
                <button
                  key={name}
                  onClick={() => toggleSubject(name)}
                  className={`px-5 py-4 rounded-[1.25rem] border-2 transition-all text-sm font-extrabold tracking-tight ${
                    selected.has(name) 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-600 shadow-lg shadow-indigo-500/10' 
                    : 'border-slate-50 bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </section>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full mt-12 py-6 bg-study-gradient text-white font-black rounded-[2rem] shadow-2xl shadow-blue-500/20 hover:opacity-90 active:scale-95 transition-all text-lg uppercase tracking-widest"
        >
          Xác nhận danh sách ({selected.size} môn)
        </button>
      </div>
    </div>
  );
};

export default SubjectSelector;
