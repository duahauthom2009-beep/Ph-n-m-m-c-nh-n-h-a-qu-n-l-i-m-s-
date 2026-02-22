
export const GRADED_SUBJECTS = [
  'Toán',
  'Ngữ văn',
  'Tiếng Anh',
  'Vật lí',
  'Hóa học',
  'Sinh học',
  'Lịch sử',
  'Địa lí',
  'GDCD',
  'Tin học',
  'GDQP',
  'GDKTPL'
];

export const PASS_FAIL_SUBJECTS = [
  'Mĩ thuật',
  'Âm nhạc',
  'Thể dục',
  'HĐTNHN',
  'GDĐP'
];

// Priority map for sorting subjects
export const SUBJECT_PRIORITY: Record<string, number> = {
  'Toán': 1,
  'Ngữ văn': 2,
  'Tiếng Anh': 3,
  'Vật lí': 4,
  'Hóa học': 5,
  'Sinh học': 6,
  'Lịch sử': 7,
  'Địa lí': 8,
  'GDCD': 9,
  'Tin học': 10,
  'GDQP': 11,
  'GDKTPL': 12,
  'Mĩ thuật': 100,
  'Âm nhạc': 101,
  'Thể dục': 102,
  'HĐTNHN': 103,
  'GDĐP': 104
};

export const GET_GRADE_COLOR = (average: number | null) => {
  if (average === null) return 'text-gray-400 bg-gray-50';
  if (average < 3.5) return 'text-red-700 bg-red-100';
  if (average < 5) return 'text-red-500 bg-red-50';
  if (average < 6.5) return 'text-yellow-600 bg-yellow-50';
  if (average < 8) return 'text-blue-500 bg-blue-50';
  return 'text-green-600 bg-green-50';
};

/**
 * Assessment logic based on Circular 22:
 * Rank is calculated based on graded subjects and pass-fail subjects.
 */
export const calculateOfficialRank = (subjects: any[], period: 'hk1' | 'hk2' | 'yearly') => {
  const gradedKey = period === 'hk1' ? 'avg1' : period === 'hk2' ? 'avg2' : 'overallAvg';
  
  const graded = subjects.filter(s => s.type === 'graded');
  const passFail = subjects.filter(s => s.type === 'pass-fail');

  const scoresPresent = graded.filter(s => s[gradedKey] !== null).length;
  // Require at least 6 graded subjects to have results to provide a rank
  if (scoresPresent < 6) return 'Chưa đủ';

  const gradedScores = graded.map(s => s[gradedKey]).filter(v => v !== null) as number[];
  
  // Rules for Pass-Fail subjects: Yearly rank depends on Pass-Fail status of HK2.
  const pfStatuses = passFail.map(s => {
    if (period === 'yearly') return s.status2;
    return period === 'hk1' ? s.status1 : s.status2;
  }).filter(v => v !== null);

  // Require all PF subjects to have a status
  if (pfStatuses.length < passFail.length) return 'Chưa đủ';

  const allPass = pfStatuses.every(s => s === 'Pass');

  // --- Mức TỐT ---
  if (allPass && gradedScores.every(v => v >= 6.5) && gradedScores.filter(v => v >= 8.0).length >= 6) {
    return 'Tốt';
  }

  // --- Mức KHÁ ---
  if (allPass && gradedScores.every(v => v >= 5.0) && gradedScores.filter(v => v >= 6.5).length >= 6) {
    return 'Khá';
  }

  // --- Mức ĐẠT ---
  // Allow 1 "Fail" in PF subjects if graded subjects are okay
  const failCount = pfStatuses.filter(s => s === 'Fail').length;
  if (failCount <= 1 && gradedScores.every(v => v >= 3.5) && gradedScores.filter(v => v >= 5.0).length >= 6) {
    return 'Đạt';
  }

  return 'Chưa đạt';
};

export const GET_COMMENT = (average: number) => {
  if (average < 3.5) return "Kết quả yếu. Cần cải thiện nhiều và luyện tập thêm.";
  if (average < 5) return "Kết quả chưa đạt. Cần nỗ lực hơn nữa.";
  if (average < 6.5) return "Kết quả trung bình. Cần cố gắng hơn.";
  if (average < 8) return "Học tốt, nên duy trì phong độ.";
  return "Xuất sắc! Tiếp tục phát huy thế mạnh.";
};
