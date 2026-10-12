import type { JSONContent } from '@tiptap/core';
import { supabase } from './supabase';

export const CATEGORIES = ['Getting Started', 'Classes', 'Progression', 'Dungeons & Raids', 'PvP & Abyss', 'Professions'] as const;

export type GuideStatus = 'draft' | 'published';

export type GuideRecord = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  content: JSONContent;
  featured: boolean;
  status: GuideStatus;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export const emptyDocument = (): JSONContent => ({
  type: 'doc', content: [{ type: 'paragraph' }]
});

export const guideSlug = (input: string) =>
  input.toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);

export async function getPublishedGuides(): Promise<GuideRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('guides')
    .select('id, slug, title, category, summary, content, featured, status, author_id, created_at, updated_at, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GuideRecord[];
}
