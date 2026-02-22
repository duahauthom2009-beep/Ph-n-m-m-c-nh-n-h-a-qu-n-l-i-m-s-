
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import SubjectSelector from './components/SubjectSelector';
import { UserProfile, SubjectData } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [subjectsSet, setSubjectsSet] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('study_user');
    const savedSubjects = localStorage.getItem('study_subjects');
    
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    if (savedSubjects) {
      setSubjectsSet(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = (name: string, className: string) => {
    const newUser = { name, className };
    setUser(newUser);
    localStorage.setItem('study_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    setSubjectsSet(false);
    
    // Reset toàn bộ dữ liệu ứng dụng để người dùng mới bắt đầu từ con số 0
    localStorage.removeItem('study_user');
    localStorage.removeItem('study_subjects');
    localStorage.removeItem('study_schedule');
    localStorage.removeItem('redeemed_cycles');
    localStorage.removeItem('app_theme');
    
    // Có thể dùng localStorage.clear() nếu muốn xóa sạch hoàn toàn mọi thứ khác
    // localStorage.clear();
  };

  const handleSubjectsComplete = (selected: { name: string; type: 'graded' | 'pass-fail' }[]) => {
    const initialSubjects: SubjectData[] = selected.map(s => ({
      id: Math.random().toString(36).substr(2, 9),
      name: s.name,
      type: s.type,
      hk1: { tx1: null, tx2: null, tx3: null, tx4: null, tx5: null, gk: null, ck: null },
      hk2: { tx1: null, tx2: null, tx3: null, tx4: null, tx5: null, gk: null, ck: null },
      avg1: null,
      avg2: null,
      overallAvg: null,
      status1: null,
      status2: null,
      comment: 'Nhập đủ 3 TX + GK + CK'
    }));
    localStorage.setItem('study_subjects', JSON.stringify(initialSubjects));
    setSubjectsSet(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-study-gradient">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-white text-xl font-bold tracking-widest animate-pulse flex items-center gap-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            HURRICANE AI
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="antialiased font-sans">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : !subjectsSet ? (
        <SubjectSelector onComplete={handleSubjectsComplete} />
      ) : (
        <Dashboard 
          user={user} 
          onLogout={handleLogout} 
          onResetSubjects={() => setSubjectsSet(false)} 
        />
      )}
    </div>
  );
};

export default App;
