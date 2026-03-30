import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * 使用 Gemini 1.5 Flash 将分析正文一次性翻译成多语言
 * @param detail 中文分析原文
 * @returns JSON 对象含各语言翻译
 */
export async function translateDetail(detail: string): Promise<Record<string, string>> {
  if (!detail) return {};
  
  const prompt = `Translate the following Chinese X/Twitter account analysis into Traditional Chinese (zh-tw), Japanese (ja), and English (en). 

Context: This is for a reputation tool. Maintain the tone of a professional investigator. 
Special terms:
- "福利博主" -> "NSFW Creator" (en), "福利ブロガー" (ja)
- "风俗" -> "Adult Entertainment/Escort" (en), "風俗" (ja)

Return ONLY a valid JSON object with keys "zh-tw", "ja", and "en".

Analysis to translate:
"${detail}"`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // 提取 JSON 块
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || '{}';
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Gemini translation error:", e);
    return {};
  }
}
