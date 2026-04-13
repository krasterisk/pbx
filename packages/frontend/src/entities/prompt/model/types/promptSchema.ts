export interface IPrompt {
  uid: number;
  filename: string;
  moh: string;
  comment: string;
  user_uid: number;
}

export interface IPromptCreate {
  comment: string;
  moh?: string;
}
