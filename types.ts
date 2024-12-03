export type Article = {
  id: string;
  title: string;
  text: string;
  fullBodyText?: string;
  keyPhrases?: string;
  url: string;
  summary?: string;
  timestamp: number;
};

export type Secret = {
  apiKey: string;
  url: string;
};
