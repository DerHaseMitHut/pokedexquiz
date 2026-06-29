export type AnswerAuthorType = 'host' | 'player';

export interface Answer {
  id: string;
  letter: string;
  authorType: AnswerAuthorType;
  authorId: string;
  text: string;
}
