export interface SoundEventSettings {
  timerTick: boolean;
  answerShow: boolean;
  answerReveal: boolean;
  voteCast: boolean;
  scoreAward: boolean;
}

export interface SoundSettings {
  sounds: boolean;
  volume: number;
  timerVolume: number;
  timerAudio?: string;
  timerAudioName?: string;
  events: SoundEventSettings;
}
