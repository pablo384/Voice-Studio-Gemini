import { GoogleGenAI, Modality } from "@google/genai";
import { MODEL_FAST_CHAT, MODEL_TTS } from "../constants";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateSpeech(text: string, voiceName: string, language: string = 'English'): Promise<string | undefined> {
  const ai = getAI();
  try {
    // If language is specified and not just default English (or if user explicitly wants English), 
    // we guide the model with a prompt instruction.
    // The pattern "Say in <Language>: <Text>" helps the model switch context.
    const promptText = language === 'English' ? text : `Say in ${language}: ${text}`;

    const response = await ai.models.generateContent({
      model: MODEL_TTS,
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    throw error;
  }
}

export async function generateFastResponse(prompt: string): Promise<string> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST_CHAT,
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Fast Chat Error:", error);
    throw error;
  }
}