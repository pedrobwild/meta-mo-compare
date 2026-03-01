import type { AggregatedMetrics, DeltaMetrics } from '../types';

export type InsightSeverity = 'high' | 'medium' | 'low';
export type InsightCategory = 'creative' | 'auction' | 'post_click' | 'efficiency' | 'fatigue' | 'budget';

export interface InsightCard {
  id: string;
  title: string;
  description: string;
  evidence: string;
  action: string;
  severity: InsightSeverity;
  category: InsightCategory;
  confidence: number; // 0-1
  affectedItems?: string[]; // campaign/adset/ad keys
  filterKey?: string; // for CTA "ver na tabela"
  filterValue?: string;
}
