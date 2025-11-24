import { AgeGroup, Gender, VoiceProfile } from "./types";

export const MODEL_TTS = "gemini-2.5-flash-preview-tts";
export const MODEL_LIVE = "gemini-2.5-flash-native-audio-preview-09-2025";
export const MODEL_FAST_CHAT = "gemini-flash-lite-latest";

export const VOICE_PROFILES: VoiceProfile[] = [
  { name: 'Puck', gender: Gender.MALE, ageGroup: AgeGroup.YOUNG, description: 'Energetic and clear' },
  { name: 'Charon', gender: Gender.MALE, ageGroup: AgeGroup.OLD, description: 'Deep and authoritative' },
  { name: 'Kore', gender: Gender.FEMALE, ageGroup: AgeGroup.MIDDLE, description: 'Soothing and calm' },
  { name: 'Fenrir', gender: Gender.MALE, ageGroup: AgeGroup.OLD, description: 'Rough and strong' },
  { name: 'Zephyr', gender: Gender.FEMALE, ageGroup: AgeGroup.YOUNG, description: 'Friendly and high-pitched' },
];

export const INITIAL_SYSTEM_INSTRUCTION_LIVE = "You are a helpful and friendly AI assistant. Keep your responses concise and natural for a voice conversation.";

export const SUPPORTED_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Japanese',
  'Korean',
  'Chinese',
  'Hindi',
  'Russian'
];