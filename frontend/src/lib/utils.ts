import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAX_LIQUIDITY = 2000000;
const MAX_VOLUME = 5000000;

export interface ConfidenceScore {
  score: number;
  level: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
  color: string;
}

export function calculateConfidence(liquidity: number, volume: number): ConfidenceScore {
  const liquidityScore = Math.min(50, (Math.log10(Math.max(liquidity, 1)) / Math.log10(MAX_LIQUIDITY)) * 50);
  const volumeScore = Math.min(50, (Math.log10(Math.max(volume, 1)) / Math.log10(MAX_VOLUME)) * 50);
  const score = Math.round(liquidityScore + volumeScore);

  let level: ConfidenceScore['level'];
  let color: string;

  if (score >= 86) {
    level = 'Very High';
    color = '#22c55e';
  } else if (score >= 66) {
    level = 'High';
    color = '#16a34a';
  } else if (score >= 46) {
    level = 'Medium';
    color = '#eab308';
  } else if (score >= 26) {
    level = 'Low';
    color = '#f97316';
  } else {
    level = 'Very Low';
    color = '#ef4444';
  }

  return { score, level, color };
}
