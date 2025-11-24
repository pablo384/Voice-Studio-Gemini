export enum AppTab {
  TTS = 'tts',
  LIVE = 'live',
  CHAT = 'chat'
}

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female'
}

export enum AgeGroup {
  YOUNG = 'Young',
  MIDDLE = 'Middle Aged',
  OLD = 'Older'
}

export interface VoiceProfile {
  name: string;
  gender: Gender;
  ageGroup: AgeGroup;
  description: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
