
import { GoogleGenAI, Type } from "@google/genai";
import { ExerciseSuggestion, Quiz } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getExerciseSuggestions = async (subject: string, score: number, className: string): Promise<ExerciseSuggestion[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Bạn là một trợ lý giáo dục AI. Học sinh lớp ${className} môn ${subject} điểm ${score}/10. Đề xuất 3 chuyên đề bài tập phù hợp chương trình lớp ${className}. Phản hồi JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Advanced'] },
              count: { type: Type.NUMBER },
              description: { type: Type.STRING }
            },
            required: ['topic', 'difficulty', 'count', 'description']
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Gemini API Error:", error);
    return defaultSuggestions(subject);
  }
};

export const searchExercises = async (query: string, className: string): Promise<ExerciseSuggestion[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tìm 3 chuyên đề bài tập lớp ${className} cho yêu cầu: "${query}". Phản hồi JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Advanced'] },
              count: { type: Type.NUMBER },
              description: { type: Type.STRING }
            },
            required: ['topic', 'difficulty', 'count', 'description']
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return [];
  }
};

export const generateQuiz = async (topic: string, className: string): Promise<Quiz> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tạo 5 câu hỏi trắc nghiệm (4 lựa chọn) về chuyên đề "${topic}" cho học sinh lớp ${className}. Ngôn ngữ: Tiếng Việt. Phản hồi JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.NUMBER, description: 'Index từ 0-3' },
                  explanation: { type: Type.STRING }
                },
                required: ['id', 'question', 'options', 'correctAnswer', 'explanation']
              }
            }
          },
          required: ['topic', 'questions']
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Quiz Error:", error);
    throw error;
  }
};

export const generateQuizFromFile = async (fileBase64: string, mimeType: string, className: string): Promise<Quiz> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: fileBase64,
            mimeType: mimeType
          }
        },
        {
          text: `Bạn là một chuyên gia giáo dục. Hãy phân tích tài liệu đính kèm và tạo một bộ đề trắc nghiệm gồm 5 câu hỏi phù hợp với trình độ học sinh lớp ${className}.
          Yêu cầu:
          1. Ngôn ngữ: Tiếng Việt.
          2. Mỗi câu hỏi có 4 lựa chọn (A, B, C, D).
          3. Cung cấp đáp án đúng (index từ 0-3) và giải thích chi tiết lý do chọn đáp án đó.
          4. Trả về kết quả dưới dạng JSON theo đúng cấu trúc schema.`
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING, description: "Chủ đề chính của tài liệu" },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.NUMBER, description: "Index của đáp án đúng (0-3)" },
                  explanation: { type: Type.STRING, description: "Giải thích chi tiết tại sao đáp án đó đúng" }
                },
                required: ['id', 'question', 'options', 'correctAnswer', 'explanation']
              }
            }
          },
          required: ['topic', 'questions']
        }
      }
    });
    
    if (!response.text) throw new Error("AI không trả về nội dung.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini File Quiz Error:", error);
    throw new Error("Không thể tạo đề từ tài liệu này. Vui lòng đảm bảo file rõ nét và thuộc định dạng hỗ trợ.");
  }
};

const defaultSuggestions = (subject: string): ExerciseSuggestion[] => [
  { topic: `${subject} - Ôn tập trọng tâm`, difficulty: 'Easy', count: 10, description: 'Củng cố nền tảng.' },
  { topic: `${subject} - Vận dụng cơ bản`, difficulty: 'Medium', count: 15, description: 'Luyện kỹ năng giải bài.' },
  { topic: `${subject} - Nâng cao bứt phá`, difficulty: 'Advanced', count: 5, description: 'Chinh phục điểm 10.' }
];
