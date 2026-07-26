export type CategoryType = 'ALL' | 'VIDEO' | 'PDF' | 'IMAGE' | 'AUDIO & CONVERT';

export interface ToolItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: 'VIDEO' | 'PDF' | 'IMAGE' | 'AUDIO & CONVERT';
  tags: string[];
  illustrationType: string;
}

export const CATEGORIES: CategoryType[] = ['ALL', 'VIDEO', 'PDF', 'IMAGE', 'AUDIO & CONVERT'];
