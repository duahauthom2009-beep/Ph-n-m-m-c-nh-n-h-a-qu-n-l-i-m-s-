
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { UserProfile, SubjectData, ExerciseSuggestion, ScoreEntry, WeeklySchedule, ScheduleEntry, Quiz } from '../types';
import { GET_GRADE_COLOR, GET_COMMENT, calculateOfficialRank, SUBJECT_PRIORITY } from '../constants';
import { getExerciseSuggestions, searchExercises, generateQuiz, generateQuizFromFile } from '../services/geminiService';

interface DashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onResetSubjects: () => void;
}

type MainView = 'dashboard' | 'exercise' | 'schedule' | 'prediction';
type AppTheme = 'default' | 'tet';
type AcademicGoal = 'excellent' | 'good';
type PracticeMode = 'search' | 'upload';

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onResetSubjects }) => {
  const [currentView, setCurrentView] = useState<MainView>('dashboard');
  const [activeTab, setActiveTab] = useState<'hk1' | 'hk2' | 'yearly'>('hk1');
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date());
  const [theme, setTheme] = useState<AppTheme>(() => (localStorage.getItem('app_theme') as AppTheme) || 'default');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('search');

  const [subjects, setSubjects] = useState<SubjectData[]>(() => {
    const saved = localStorage.getItem('study_subjects');
    return saved ? JSON.parse(saved) : [];
  });

  const [schedule, setSchedule] = useState<WeeklySchedule>(() => {
    const saved = localStorage.getItem('study_schedule');
    return saved ? JSON.parse(saved) : {};
  });

  const [recommendations, setRecommendations] = useState<ExerciseSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchingQuery] = useState('');

  // Practice State
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isShowingResult, setIsShowingResult] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PREDICTION STATE
  const [targetGoal, setTargetGoal] = useState<AcademicGoal>(() => (localStorage.getItem('target_goal') as AcademicGoal) || 'good');
  const [strongSubjects, setStrongSubjects] = useState<string[]>(() => {
    const saved = localStorage.getItem('strong_subjects');
    return saved ? JSON.parse(saved) : [];
  });

  // REWARD LOGIC
  const [redeemedCycles, setRedeemedCycles] = useState<number>(() => {
    const saved = localStorage.getItem('redeemed_cycles');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [showRewardBanner, setShowRewardBanner] = useState(false);

  const quotes = [
    "Chúc mừng bạn đã nỗ lực! 🌪️",
    "Chăm chỉ mới thành công! ✨",
    "Bứt phá mọi giới hạn cùng Hurricane AI! 🚀",
    "Học tập là chìa khóa của tương lai! 🔑",
    "Bạn đang đi đúng hướng đấy! 🌟",
    "Kiên trì là mẹ thành công! 💪"
  ];
  const [currentQuote, setCurrentQuote] = useState(quotes[0]);

  const toggleStrongSubject = (name: string) => {
    setStrongSubjects(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name);
      if (prev.length >= 6) return prev;
      return [...prev, name];
    });
  };

  const calculateFullYearPrediction = (s: SubjectData) => {
    const isStrong = strongSubjects.includes(s.name);
    const target = targetGoal === 'excellent' ? (isStrong ? 9.0 : 6.5) : (isStrong ? 8.0 : 6.5);
    
    if (s.overallAvg !== null && s.overallAvg >= target) {
      return { 
        target: target.toFixed(1), 
        status: 'achieved' as const, 
        hk1: null, 
        hk2: null, 
        comment: `Chúc mừng! Bạn đã đạt mục tiêu môn ${s.name}. Hãy tiếp tục duy trì phong độ này.` 
      };
    }

    const predictForSemester = (sc: ScoreEntry, targetSem: number) => {
      const txs = [sc.tx1, sc.tx2, sc.tx3, sc.tx4, sc.tx5].filter(v => v !== null) as number[];
      const txCount = Math.max(3, txs.length);
      const currentSum = txs.reduce((a, b) => a + b, 0);
      
      let txNeeded = null;
      let gkNeeded = null;
      let ckNeeded = null;

      if (sc.gk === null && sc.ck === null) {
        // Assume we need to fill at least 3 TX scores if not enough
        const remainingTX = Math.max(0, 3 - txs.length);
        const totalWeight = txCount + 5;
        const totalNeeded = targetSem * totalWeight;
        
        // Simple heuristic: distribute remaining points
        const remainingNeeded = totalNeeded - currentSum;
        // Weight: remainingTX (1x) + GK (2x) + CK (3x)
        const avgScore = Math.max(0, Math.min(10, Math.round((remainingNeeded / (remainingTX + 5)) * 10) / 10));
        
        txNeeded = remainingTX > 0 ? avgScore : null;
        gkNeeded = avgScore;
        ckNeeded = avgScore;
      } else if (sc.gk !== null && sc.ck === null) {
        const totalWeight = txCount + 5;
        const totalNeeded = targetSem * totalWeight;
        const currentSumWithGK = currentSum + sc.gk * 2;
        ckNeeded = Math.max(0, Math.min(10, Math.round(((totalNeeded - currentSumWithGK) / 3) * 10) / 10));
      }

      return { tx: txNeeded, gk: gkNeeded, ck: ckNeeded };
    };

    let hk1Pred = null;
    let hk2Pred = null;
    let overallComment = "";

    if (s.avg1 === null) {
      hk1Pred = predictForSemester(s.hk1, target);
      hk2Pred = { tx: target, gk: target, ck: target };
      overallComment = `Bạn cần tập trung ngay từ Học kì I. Mục tiêu trung bình mỗi kì là ${target}.`;
    } else {
      const requiredAvg2 = Math.max(0, Math.round(((3 * target - s.avg1) / 2) * 10) / 10);
      if (s.avg2 === null) {
        hk2Pred = predictForSemester(s.hk2, requiredAvg2);
        overallComment = s.avg1 >= target 
          ? `Học kì I tốt (${s.avg1}). HK II chỉ cần duy trì khoảng ${requiredAvg2} để đạt mục tiêu.`
          : `Học kì I hơi thấp (${s.avg1}). Bạn cần bứt phá ở HK II với điểm trung bình ${requiredAvg2}.`;
      } else if (s.overallAvg !== null && s.overallAvg < target) {
        overallComment = `Kết quả cả năm (${s.overallAvg}) chưa đạt mục tiêu ${target}. Hãy cố gắng hơn ở năm học tới!`;
      }
    }

    return {
      target: target.toFixed(1),
      status: 'pending' as const,
      hk1: hk1Pred,
      hk2: hk2Pred,
      comment: overallComment
    };
  };

  useEffect(() => {
    document.body.className = `antialiased theme-${theme}`;
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('study_subjects', JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem('study_schedule', JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    localStorage.setItem('redeemed_cycles', redeemedCycles.toString());
  }, [redeemedCycles]);

  useEffect(() => {
    localStorage.setItem('strong_subjects', JSON.stringify(strongSubjects));
    localStorage.setItem('target_goal', targetGoal);
  }, [strongSubjects, targetGoal]);

  const totalLifetimeBars = useMemo(() => {
    let total = 0;
    subjects.forEach(s => {
      if (s.type === 'graded') {
        ['hk1', 'hk2'].forEach(semKey => {
          const scores = (s as any)[semKey];
          if (!scores) return;
          ['tx1', 'tx2', 'tx3', 'tx4', 'tx5'].forEach(tx => {
            if (scores[tx] === 10) total += 1;
          });
          if (scores.gk === 10) total += 2;
          if (scores.ck === 10) total += 3;
        });
      }
    });
    return total;
  }, [subjects]);

  const currentBars = Math.max(0, totalLifetimeBars - (redeemedCycles * 10));

  const handleClaimReward = () => {
    if (currentBars >= 10) {
      setRedeemedCycles(prev => prev + 1);
      setCurrentQuote(quotes[Math.floor(Math.random() * quotes.length)]);
      setShowRewardBanner(true);
      setTimeout(() => setShowRewardBanner(false), 5000);
    }
  };

  const stableSortedSubjects = useMemo(() => {
    return [...subjects].sort((a, b) => {
      const pA = SUBJECT_PRIORITY[a.name] || 999;
      const pB = SUBJECT_PRIORITY[b.name] || 999;
      return pA - pB;
    });
  }, [subjects]);

  const calculateOfficialAvg = (sc: ScoreEntry) => {
    const txs = [sc.tx1, sc.tx2, sc.tx3, sc.tx4, sc.tx5].filter(v => v !== null) as number[];
    if (txs.length >= 3 && sc.gk !== null && sc.ck !== null) {
      const sum = txs.reduce((a, b) => a + b, 0) + sc.gk * 2 + sc.ck * 3;
      const weight = txs.length + 5;
      return Math.round((sum / weight) * 10) / 10;
    }
    return null;
  };

  const handleScoreChange = (id: string, field: keyof ScoreEntry, value: string) => {
    if (activeTab === 'yearly') return;
    const num = value === '' ? null : Math.min(10, Math.max(0, parseFloat(value)));
    
    setSubjects(prev => prev.map(s => {
      if (s.id !== id) return s;
      const scoreKey = activeTab === 'hk1' ? 'hk1' : 'hk2';
      const updatedHk = { ...s[scoreKey], [field]: num };
      const tempSub = { ...s, [scoreKey]: updatedHk };

      if (tempSub.type === 'graded') {
        tempSub.avg1 = calculateOfficialAvg(tempSub.hk1);
        tempSub.avg2 = calculateOfficialAvg(tempSub.hk2);

        if (tempSub.avg1 !== null && tempSub.avg2 !== null) {
          tempSub.overallAvg = Math.round(((tempSub.avg1 + tempSub.avg2 * 2) / 3) * 10) / 10;
        } else {
          tempSub.overallAvg = null;
        }
      } else {
        const required1 = [tempSub.hk1.tx1, tempSub.hk1.tx2, tempSub.hk1.tx3, tempSub.hk1.gk, tempSub.hk1.ck];
        tempSub.status1 = required1.every(v => v !== null) ? (required1.every(v => v === 1) ? 'Pass' : 'Fail') : null;
        const required2 = [tempSub.hk2.tx1, tempSub.hk2.tx2, tempSub.hk2.tx3, tempSub.hk2.gk, tempSub.hk2.ck];
        tempSub.status2 = required2.every(v => v !== null) ? (required2.every(v => v === 1) ? 'Pass' : 'Fail') : null;
      }
      return tempSub;
    }));
  };

  const handleAssessmentToggle = (id: string, field: keyof ScoreEntry, val: number) => {
    if (activeTab === 'yearly') return;
    const sub = subjects.find(x => x.id === id);
    if (!sub) return;
    const scoreKey = activeTab === 'hk1' ? 'hk1' : 'hk2';
    const current = sub[scoreKey][field];
    const nextValue = current === val ? null : val;
    handleScoreChange(id, field, nextValue === null ? '' : nextValue.toString());
  };

  const handleSmartSearch = useCallback(async (q?: string) => {
    setIsSearching(true);
    try {
      if (q || searchQuery) {
        const res = await searchExercises(q || searchQuery, user.className);
        setRecommendations(res);
      } else {
        const key = activeTab === 'hk1' ? 'avg1' : 'avg2';
        const targetSubjects = subjects.filter(s => s.type === 'graded' && s[key] !== null);
        const weakOne = targetSubjects.filter(s => s[key]! < 6.5).sort((a, b) => (a[key] || 0) - (b[key] || 0))[0];
        const target = weakOne || subjects.find(s => s.type === 'graded');
        if (target) {
          const res = await getExerciseSuggestions(target.name, target[key] || 7.0, user.className);
          setRecommendations(res);
        }
      }
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  }, [searchQuery, subjects, activeTab, user.className]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQuizLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const quiz = await generateQuizFromFile(base64, file.type, user.className);
        setActiveQuiz(quiz);
        setQuizStep(0);
        setQuizScore(0);
        setSelectedAnswer(null);
        setIsShowingResult(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      alert("Không thể xử lý file. Vui lòng thử lại với file khác.");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleDownloadQuiz = () => {
    if (!activeQuiz) return;
    
    let content = `ĐỀ LUYỆN TẬP: ${activeQuiz.topic}\n`;
    content += `Học sinh: ${user.name} - Lớp: ${user.className}\n`;
    content += `Hệ thống: Hurricane AI\n`;
    content += `------------------------------------------\n\n`;
    
    activeQuiz.questions.forEach((q, i) => {
      content += `Câu ${i + 1}: ${q.question}\n`;
      q.options.forEach((opt, idx) => {
        content += `   ${String.fromCharCode(65 + idx)}. ${opt}\n`;
      });
      content += `\n`;
    });
    
    content += `------------------------------------------\n`;
    content += `ĐÁP ÁN & GIẢI THÍCH\n`;
    activeQuiz.questions.forEach((q, i) => {
      content += `Câu ${i + 1}: ${String.fromCharCode(65 + q.correctAnswer)}\n`;
      content += `Giải thích: ${q.explanation}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HurricaneAI_Quiz_${activeQuiz.topic.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleStartPractice = async (topic: string) => {
    setQuizLoading(true);
    try {
      const quiz = await generateQuiz(topic, user.className);
      setActiveQuiz(quiz);
      setQuizStep(0);
      setQuizScore(0);
      setSelectedAnswer(null);
      setIsShowingResult(false);
    } catch (e) {
      alert("Không thể kết nối với Hurricane AI Practice lúc này.");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleAnswer = () => {
    if (selectedAnswer === null || !activeQuiz) return;
    if (selectedAnswer === activeQuiz.questions[quizStep].correctAnswer) {
      setQuizScore(prev => prev + 1);
    }
    setIsShowingResult(true);
  };

  const nextStep = () => {
    if (!activeQuiz) return;
    if (quizStep < activeQuiz.questions.length - 1) {
      setQuizStep(prev => prev + 1);
      setSelectedAnswer(null);
      setIsShowingResult(false);
    } else {
      setIsShowingResult(true);
    }
  };

  useEffect(() => {
    if (currentView === 'exercise' && recommendations.length === 0 && !isSearching) {
      handleSmartSearch();
    }
  }, [currentView, recommendations.length, isSearching, handleSmartSearch]);

  const stats = useMemo(() => {
    const key = activeTab === 'hk1' ? 'avg1' : activeTab === 'hk2' ? 'avg2' : 'overallAvg';
    const graded = subjects.filter(s => s.type === 'graded' && s[key] !== null);
    const gpa = graded.length ? Math.round((graded.reduce((a, b) => a + (b[key] || 0), 0) / graded.length) * 10) / 10 : 0;
    
    let rank = 'Chưa đủ';
    if (activeTab === 'hk1') rank = calculateOfficialRank(subjects, 'hk1');
    else if (activeTab === 'hk2') rank = calculateOfficialRank(subjects, 'hk2');
    else rank = calculateOfficialRank(subjects, 'yearly');

    return { gpa, rank, chartData: graded.map(s => ({ name: s.name, val: s[key] })) };
  }, [subjects, activeTab]);

  const moveWeek = (offset: number) => {
    const next = new Date(selectedWeekDate);
    next.setDate(selectedWeekDate.getDate() + offset * 7);
    setSelectedWeekDate(next);
  };

  const goToToday = () => setSelectedWeekDate(new Date());

  const handleScheduleChange = (dateKey: string, session: keyof ScheduleEntry, value: string) => {
    setSchedule(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || { morning: '', afternoon: '', evening: '' }),
        [session]: value
      }
    }));
  };

  const weekDates = useMemo(() => {
    const start = new Date(selectedWeekDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [selectedWeekDate]);

  const formatDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const petals = useMemo(() => {
    if (theme !== 'tet') return null;
    return Array.from({ length: 15 }).map((_, i) => (
      <div key={i} className="petal" style={{
        left: `${Math.random() * 100}vw`,
        animationDuration: `${Math.random() * 5 + 5}s`,
        animationDelay: `${Math.random() * 5}s`,
        fontSize: `${Math.random() * 15 + 15}px`
      }}>{['🌸', '🌺', '🏮', '🧧'][Math.floor(Math.random() * 4)]}</div>
    ));
  }, [theme]);

  return (
    <div className="min-h-screen transition-all duration-700 pb-10">
      {petals}
      
      {showRewardBanner && (
        <div className="fixed top-24 left-0 right-0 z-[100] flex justify-center pointer-events-none animate-in slide-in-from-top duration-700">
          <div className="bg-study-gradient px-12 py-4 rounded-full shadow-2xl border-4 border-white flex items-center gap-4 text-white font-black uppercase tracking-widest">{currentQuote} ✨</div>
        </div>
      )}

      <div className="fixed bottom-24 right-8 z-[60] group">
        <button onClick={handleClaimReward} disabled={currentBars < 10} className={`w-24 h-24 glass rounded-full border-2 border-white/50 shadow-2xl overflow-hidden backdrop-blur-md transition-all duration-500 ${currentBars >= 10 ? 'ring-4 ring-yellow-400 animate-pulse scale-110' : ''}`}>
          <div className="text-center">
            <span className="text-4xl block">🐷</span>
            <div className="flex items-center justify-center gap-1 mt-1 text-slate-700 font-black text-xs">{currentBars}🪙</div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-yellow-400/30 transition-all duration-1000" style={{ height: `${Math.min(100, (currentBars / 10) * 100)}%` }} />
        </button>
      </div>
      
      <header className="glass sticky top-0 z-50 px-6 h-20 flex items-center justify-between border-b shadow-sm">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <h1 className="text-2xl font-black text-study-gradient tracking-tighter cursor-pointer flex items-center gap-2" onClick={() => { setCurrentView('dashboard'); setActiveQuiz(null); }}>
            <div className="float-animation"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
            Hurricane AI
          </h1>
          <nav className="hidden md:flex gap-1 bg-slate-100/50 p-1 rounded-2xl">
            {(['dashboard', 'exercise', 'prediction', 'schedule'] as const).map(v => (
              <button key={v} onClick={() => { setCurrentView(v); setActiveQuiz(null); }} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentView === v ? 'bg-white shadow text-accent' : 'text-slate-400 hover:text-slate-600'}`}>{v === 'dashboard' ? 'Bảng điểm' : v === 'exercise' ? 'Luyện tập' : v === 'prediction' ? 'Dự đoán AI' : 'Lịch học'}</button>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <button onClick={() => setTheme(theme === 'default' ? 'tet' : 'default')} className="p-2 bg-slate-100 rounded-xl text-xl transition-transform hover:scale-110 active:scale-95">{theme === 'tet' ? '🧧' : '🌪️'}</button>
            <div className="text-right hidden sm:block leading-none">
              <p className="text-sm font-black text-slate-800 uppercase">{user.name}</p>
              <p className="text-[10px] text-accent font-black uppercase mt-1">Lớp {user.className}</p>
            </div>
            <button onClick={onLogout} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8 pb-20">
        {currentView === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-study-gradient"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Xếp loại {activeTab === 'yearly' ? 'Cả năm' : (activeTab === 'hk1' ? 'Kì I' : 'Kì II')}</p>
                <div className={`text-6xl font-black mb-1 transition-transform group-hover:scale-110 ${stats.rank === 'Tốt' ? 'text-emerald-500' : stats.rank === 'Khá' ? 'text-blue-500' : stats.rank === 'Đạt' ? 'text-amber-500' : 'text-slate-300'}`}>{stats.rank}</div>
                <p className="text-sm font-bold text-slate-500 uppercase">ĐTB CHUNG: {stats.gpa}</p>
              </div>
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 md:col-span-3">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Biểu đồ năng lực</h3>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {(['hk1', 'hk2', 'yearly'] as const).map(t => (
                      <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeTab === t ? 'bg-white shadow text-accent' : 'text-slate-400'}`}>{t === 'hk1' ? 'KÌ I' : t === 'hk2' ? 'KÌ II' : 'CẢ NĂM'}</button>
                    ))}
                  </div>
                </div>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={stats.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 10]} hide /><Bar dataKey="val" radius={[6, 6, 0, 0]} barSize={40}>{stats.chartData.map((e, i) => <Cell key={i} fill={e.val >= 8 ? '#10b981' : '#3b82f6'} />)}</Bar><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 800 }} /></BarChart></ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <th className="px-10 py-8 min-w-[200px]">Môn học</th>
                    {activeTab !== 'yearly' ? (<><th className="px-3 py-8 text-center">TX1</th><th className="px-3 py-8 text-center">TX2</th><th className="px-3 py-8 text-center">TX3</th><th className="px-3 py-8 text-center">TX4</th><th className="px-3 py-8 text-center">TX5</th><th className="px-3 py-8 text-center bg-accent-soft/30">GK</th><th className="px-3 py-8 text-center bg-accent-soft/30">CK</th></>) : (<th className="px-10 py-8 text-center">Học kì I</th>)}
                    <th className="px-6 py-8 text-center min-w-[120px]">{activeTab === 'yearly' ? 'Học kì II' : 'TB học kì'}</th>
                    {activeTab === 'yearly' && <th className="px-10 py-8 text-center bg-accent-soft/50 min-w-[120px]">Cả năm</th>}
                    <th className="px-10 py-8">Nhận xét</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stableSortedSubjects.map(s => {
                    const sk = activeTab === 'hk1' ? 'hk1' : 'hk2';
                    const scores = s[sk];
                    const semVal = activeTab === 'hk1' ? s.avg1 : s.avg2;
                    const semStatus = activeTab === 'hk1' ? s.status1 : s.status2;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/30 transition-all group">
                        <td className="px-10 py-8"><div className="font-black text-slate-800 text-lg leading-tight">{s.name}</div><div className="text-[9px] text-slate-300 uppercase font-black">{s.type === 'graded' ? 'Tính điểm' : 'Nhận xét'}</div></td>
                        {activeTab !== 'yearly' ? (
                          <>
                            {(['tx1', 'tx2', 'tx3', 'tx4', 'tx5', 'gk', 'ck'] as const).map(f => (
                              <td key={f} className="px-2 py-8 text-center">
                                {s.type === 'graded' ? (
                                  <div className="relative inline-block">
                                    <input type="number" step="0.1" value={scores[f] ?? ''} onChange={e => handleScoreChange(s.id, f, e.target.value)} className={`w-12 h-12 rounded-xl text-center font-black outline-none border bg-white transition-all ${scores[f] === 10 ? 'border-yellow-400 ring-4 ring-yellow-400/10' : 'border-slate-300 focus:border-accent'}`} />
                                    {scores[f] === 10 && <span className="absolute -top-2 -right-2 text-[10px] animate-bounce">🪙</span>}
                                  </div>
                                ) : (
                                  ['tx1', 'tx2', 'tx3', 'gk', 'ck'].includes(f) && (
                                    <div className="flex flex-col gap-1 items-center">
                                       <button onClick={() => handleAssessmentToggle(s.id, f, 1)} className={`w-10 h-6 text-[8px] font-black rounded-md ${scores[f] === 1 ? 'bg-emerald-500 text-white shadow' : 'bg-white border text-slate-300'}`}>ĐẠT</button>
                                       <button onClick={() => handleAssessmentToggle(s.id, f, 0)} className={`w-10 h-6 text-[8px] font-black rounded-md ${scores[f] === 0 ? 'bg-rose-500 text-white shadow' : 'bg-white border text-slate-300'}`}>CĐ</button>
                                    </div>
                                  )
                                )}
                              </td>
                            ))}
                            <td className="px-6 py-8 text-center">
                              <span className={`px-4 py-2 rounded-2xl font-black text-sm border-2 ${s.type === 'graded' ? GET_GRADE_COLOR(semVal) : semStatus === 'Pass' ? 'bg-emerald-500 text-white' : semStatus === 'Fail' ? 'bg-rose-500 text-white' : 'text-slate-300'}`}>{s.type === 'graded' ? semVal?.toFixed(1) || '--' : (semStatus === 'Pass' ? 'ĐẠT' : (semStatus === 'Fail' ? 'C.ĐẠT' : '--'))}</span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-10 py-8 text-center font-extrabold text-slate-700 text-lg">{s.type === 'graded' ? s.avg1?.toFixed(1) || '--' : (s.status1 === 'Pass' ? 'ĐẠT' : '--')}</td>
                            <td className="px-10 py-8 text-center font-extrabold text-slate-700 text-lg">{s.type === 'graded' ? s.avg2?.toFixed(1) || '--' : (s.status2 === 'Pass' ? 'ĐẠT' : '--')}</td>
                            <td className="px-10 py-8 text-center">
                              <div className={`font-extrabold text-lg ${s.type === 'graded' && s.overallAvg !== null ? 'text-accent' : 'text-slate-700'}`}>
                                {s.type === 'graded' ? s.overallAvg?.toFixed(1) || '--' : (s.status2 === 'Pass' ? 'ĐẠT' : '--')}
                              </div>
                            </td>
                          </>
                        )}
                        <td className="px-10 py-8 text-[11px] text-slate-400 italic font-bold max-w-xs">{s.type === 'graded' ? (semVal ? GET_COMMENT(semVal) : 'Chưa đủ 3 TX + GK + CK') : (semStatus ? (semStatus === 'Pass' ? 'Đạt yêu cầu' : 'Cần cố gắng') : 'Chưa đánh giá')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentView === 'exercise' && (
          <div className="space-y-8 animate-in slide-in-from-bottom duration-700">
             {!activeQuiz && (
               <div className="flex justify-center gap-4 bg-slate-50/50 p-2 rounded-3xl w-fit mx-auto">
                  <button onClick={() => setPracticeMode('search')} className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${practiceMode === 'search' ? 'bg-study-gradient text-white shadow-xl scale-105' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>Hurricane AI Search</button>
                  <button onClick={() => setPracticeMode('upload')} className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${practiceMode === 'upload' ? 'bg-study-gradient text-white shadow-xl scale-105' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>Tải tài liệu luyện tập</button>
               </div>
             )}

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center gap-8 relative overflow-hidden">
              <div className="w-full text-center z-10">
                <h2 className="text-3xl font-black text-slate-800 mb-6 flex items-center justify-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center text-3xl shadow-inner border border-white">
                    {practiceMode === 'search' ? (theme === 'tet' ? '🧧' : '🌪️') : '📄'}
                  </div>
                  {practiceMode === 'search' ? 'Hurricane AI Practice' : 'Tạo đề từ tài liệu'}
                </h2>
                
                {practiceMode === 'search' ? (
                  <div className="flex flex-col md:flex-row gap-4 max-w-4xl mx-auto w-full">
                    <div className="relative flex-grow">
                      <input type="text" placeholder="Tìm chuyên đề bài tập..." value={searchQuery} onChange={e => setSearchingQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSmartSearch()} className="w-full pl-14 pr-6 py-6 rounded-3xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-accent transition-all outline-none font-bold text-slate-700 shadow-inner" />
                      <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <button onClick={() => handleSmartSearch()} disabled={isSearching} className="bg-study-gradient text-white px-12 py-6 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4">
                      {isSearching ? <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>🤖 TÌM KIẾM AI</span>}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6 max-w-xl mx-auto w-full p-8 border-4 border-dashed border-slate-100 rounded-[2.5rem] hover:border-accent transition-all group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,application/pdf" />
                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">📤</div>
                    <div>
                       <p className="font-black text-slate-800 text-lg">Click để tải lên tài liệu</p>
                       <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">Hỗ trợ Ảnh & PDF</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {quizLoading ? (
              <div className="py-20 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-2 border-dashed border-accent animate-pulse">
                <div className="w-16 h-16 border-4 border-t-transparent border-accent rounded-full animate-spin mb-4"></div>
                <p className="font-black uppercase tracking-widest text-accent">Hurricane AI đang soạn đề...</p>
              </div>
            ) : activeQuiz ? (
              <div className="max-w-3xl mx-auto space-y-8 animate-in zoom-in duration-500">
                <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-10 pb-6 border-b">
                     <div><h2 className="text-2xl font-black text-slate-800">{activeQuiz.topic}</h2><p className="text-xs font-bold text-accent uppercase mt-1">Câu hỏi {quizStep + 1} / {activeQuiz.questions.length}</p></div>
                     <div className="flex gap-2">
                       <button onClick={handleDownloadQuiz} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2 font-bold text-xs">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                         TẢI ĐỀ
                       </button>
                       <button onClick={() => { setActiveQuiz(null); setPracticeMode('search'); }} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-red-500 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
                     </div>
                  </div>
                  <div className="space-y-8">
                    <p className="text-xl font-bold text-slate-700 leading-relaxed">{activeQuiz.questions[quizStep].question}</p>
                    <div className="grid grid-cols-1 gap-4">
                      {activeQuiz.questions[quizStep].options.map((opt, idx) => (
                        <button key={idx} disabled={isShowingResult} onClick={() => setSelectedAnswer(idx)} className={`w-full p-6 text-left rounded-3xl border-2 transition-all font-bold text-lg ${selectedAnswer === idx ? 'border-accent bg-accent-soft text-accent' : 'bg-slate-50 border-transparent text-slate-600'}`}>
                          <span className="inline-block w-8 h-8 rounded-lg bg-white/50 text-center mr-4">{String.fromCharCode(65 + idx)}</span>{opt}
                        </button>
                      ))}
                    </div>
                    {isShowingResult && (
                      <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 animate-in fade-in slide-in-from-top duration-300">
                         <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Giải thích AI:</p>
                         <p className="text-slate-600 font-medium leading-relaxed italic">{activeQuiz.questions[quizStep].explanation}</p>
                      </div>
                    )}
                    <button onClick={isShowingResult ? nextStep : handleAnswer} disabled={!isShowingResult && selectedAnswer === null} className="w-full py-6 bg-study-gradient text-white rounded-3xl font-black text-lg uppercase tracking-widest shadow-xl">{isShowingResult ? (quizStep < activeQuiz.questions.length - 1 ? 'CÂU TIẾP THEO' : 'KẾT THÚC') : 'KIỂM TRA'}</button>
                  </div>
                </div>
              </div>
            ) : practiceMode === 'search' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {recommendations.map((r, i) => (
                  <div key={i} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200 hover:border-accent transition-all flex flex-col group">
                    <span className="px-4 py-1.5 bg-accent-soft text-accent rounded-xl text-[10px] font-black uppercase tracking-widest mb-8 self-start">{r.difficulty}</span>
                    <h4 className="font-black text-slate-800 text-2xl mb-4 group-hover:text-accent transition-colors">{r.topic}</h4>
                    <p className="text-slate-500 text-sm mb-10 flex-grow leading-relaxed font-medium">{r.description}</p>
                    <button onClick={() => handleStartPractice(r.topic)} className="w-full py-5 bg-slate-50 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all hover:bg-accent hover:text-white">BẮT ĐẦU LUYỆN TẬP</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'schedule' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
               <div className="flex gap-2">
                 <button onClick={() => moveWeek(-1)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all">◀</button>
                 <button onClick={goToToday} className="px-6 bg-accent-soft text-accent rounded-2xl hover:opacity-80 transition-all text-[10px] font-black uppercase tracking-widest">Hiện tại</button>
               </div>
               <div className="text-center">
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                    Tuần này: {weekDates[0].toLocaleDateString('vi-VN')} - {weekDates[6].toLocaleDateString('vi-VN')}
                  </h2>
                  <p className="text-[10px] font-black text-accent uppercase mt-1 tracking-widest">Hurricane Schedule 🌪️</p>
               </div>
               <button onClick={() => moveWeek(1)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all">▶</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {weekDates.map((date, idx) => {
                const dateKey = formatDateKey(date);
                const dayData = schedule[dateKey] || { morning: '', afternoon: '', evening: '' };
                const isToday = formatDateKey(new Date()) === dateKey;
                return (
                  <div key={dateKey} className={`bg-white p-6 rounded-[2.5rem] shadow-sm border transition-all ${isToday ? 'ring-4 ring-accent/10 border-accent/50' : 'border-slate-200'}`}>
                    <p className={`text-[10px] font-black uppercase text-center mb-4 ${idx === 6 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][idx]} {date.getDate()}/{date.getMonth()+1}
                    </p>
                    <div className="space-y-4">
                      {(['morning', 'afternoon', 'evening'] as const).map(session => (
                        <div key={session}>
                          <span className="text-[8px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
                            {session === 'morning' ? '☀️ Sáng' : session === 'afternoon' ? '⛅ Chiều' : '🌙 Tối'}
                          </span>
                          <textarea value={dayData[session]} onChange={e => handleScheduleChange(dateKey, session, e.target.value)} placeholder="..." className="w-full p-4 bg-slate-50 border-none rounded-2xl text-[10px] focus:ring-1 ring-accent outline-none h-24 font-bold resize-none" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {currentView === 'prediction' && (
           <div className="space-y-8 animate-in slide-in-from-bottom duration-700">
             <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Dự báo Năng lực AI 🌪️</h2>
                <p className="text-slate-400 font-bold mt-2 leading-relaxed">Phân tích chính xác điểm số cần đạt dựa trên các đầu điểm đã nhập. Chọn 6 môn thế mạnh của bạn bên dưới.</p>
              </div>

              <div className="flex justify-center gap-4 mb-10">
                <button onClick={() => setTargetGoal('excellent')} className={`flex-1 max-w-[280px] p-6 rounded-[2rem] border-4 transition-all flex flex-col items-center gap-2 ${targetGoal === 'excellent' ? 'bg-amber-50 border-amber-400 scale-105 shadow-xl' : 'bg-slate-50 border-transparent opacity-60'}`}>
                  <span className="text-4xl">🏆</span><span className="font-black text-sm uppercase">Học sinh Xuất sắc</span><p className="text-[10px] font-bold text-slate-500 text-center mt-1">6 môn ≥ 8.0, còn lại ≥ 6.5 <br/> Đánh giá: Đạt</p>
                </button>
                <button onClick={() => setTargetGoal('good')} className={`flex-1 max-w-[280px] p-6 rounded-[2rem] border-4 transition-all flex flex-col items-center gap-2 ${targetGoal === 'good' ? 'bg-blue-50 border-blue-400 scale-105 shadow-xl' : 'bg-slate-50 border-transparent opacity-60'}`}>
                  <span className="text-4xl">🌟</span><span className="font-black text-sm uppercase">Học sinh Giỏi</span><p className="text-[10px] font-bold text-slate-500 text-center mt-1">6 môn ≥ 6.5, còn lại ≥ 5.0 <br/> Đánh giá: Đạt</p>
                </button>
              </div>

              <div className="mb-12">
                 <p className="text-xs font-black uppercase text-slate-400 mb-4 px-2 tracking-widest flex items-center justify-between">
                   <span>Chọn 6 môn thế mạnh (để bứt phá mục tiêu):</span>
                   <span className={strongSubjects.length === 6 ? 'text-emerald-500' : 'text-blue-500'}>{strongSubjects.length}/6 môn</span>
                 </p>
                 <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {subjects.filter(s => s.type === 'graded').map(s => (
                      <button 
                        key={s.id} 
                        onClick={() => toggleStrongSubject(s.name)} 
                        className={`px-4 py-3 rounded-2xl border-2 font-black text-xs transition-all ${strongSubjects.includes(s.name) ? 'bg-study-gradient text-white border-transparent shadow-lg scale-105' : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'}`}
                      >
                        {s.name}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subjects.filter(s => s.type === 'graded').map(s => {
                  const prediction = calculateFullYearPrediction(s);
                  const isStrong = strongSubjects.includes(s.name);
                  return (
                    <div key={s.id} className={`p-8 rounded-[2.5rem] border-2 shadow-sm transition-all relative overflow-hidden ${isStrong ? 'bg-white border-accent' : 'bg-slate-50/50 border-white'}`}>
                      {isStrong && <div className="absolute top-0 right-0 bg-accent text-white px-4 py-1 rounded-bl-2xl text-[10px] font-black uppercase">TOP 6</div>}
                      <h4 className="font-black text-xl text-slate-800 mb-1">{s.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mục tiêu Cả năm: {prediction.target}</p>
                      
                      <div className="space-y-3">
                        {prediction.status === 'achieved' ? (
                          <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-emerald-700 font-black text-xs uppercase"><span>🎉</span>Đã đạt mục tiêu!</div>
                            <p className="text-[11px] text-emerald-600 italic">{prediction.comment}</p>
                          </div>
                        ) : (
                          <>
                            {prediction.hk1 && (
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[9px] font-black text-accent uppercase mb-2">Dự kiến Học kì I</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {prediction.hk1.tx !== null && <div className="text-center"><p className="text-[8px] text-slate-400 uppercase">TX</p><p className="font-black text-slate-800">{prediction.hk1.tx}</p></div>}
                                  {prediction.hk1.gk !== null && <div className="text-center"><p className="text-[8px] text-slate-400 uppercase">GK</p><p className="font-black text-slate-800">{prediction.hk1.gk}</p></div>}
                                  {prediction.hk1.ck !== null && <div className="text-center"><p className="text-[8px] text-slate-400 uppercase">CK</p><p className="font-black text-slate-800">{prediction.hk1.ck}</p></div>}
                                </div>
                              </div>
                            )}
                            {prediction.hk2 && (
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[9px] font-black text-accent uppercase mb-2">Dự kiến Học kì II</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {prediction.hk2.tx !== null && <div className="text-center"><p className="text-[8px] text-slate-400 uppercase">TX</p><p className="font-black text-slate-800">{prediction.hk2.tx}</p></div>}
                                  {prediction.hk2.gk !== null && <div className="text-center"><p className="text-[8px] text-slate-400 uppercase">GK</p><p className="font-black text-slate-800">{prediction.hk2.gk}</p></div>}
                                  {prediction.hk2.ck !== null && <div className="text-center"><p className="text-[8px] text-slate-400 uppercase">CK</p><p className="font-black text-slate-800">{prediction.hk2.ck}</p></div>}
                                </div>
                              </div>
                            )}
                            <p className="text-[11px] text-slate-500 italic px-2 mt-2 leading-relaxed">{prediction.comment}</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
           </div>
        )}
      </main>

      <div className="md:hidden fixed bottom-6 left-6 right-6 bg-white shadow-2xl rounded-3xl border p-2 flex justify-around items-center z-50">
        {(['dashboard', 'exercise', 'prediction', 'schedule'] as const).map(v => (
          <button key={v} onClick={() => { setCurrentView(v); setActiveQuiz(null); }} className={`flex-1 flex flex-col items-center py-4 rounded-2xl ${currentView === v ? 'bg-accent text-white shadow-lg' : 'text-slate-400'}`}>
            <span className="text-[10px] font-black uppercase">{v === 'dashboard' ? 'Điểm' : v === 'exercise' ? 'AI' : v === 'prediction' ? 'Dự báo' : 'Lịch'}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
