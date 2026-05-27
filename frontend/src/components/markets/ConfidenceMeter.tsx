import { useEffect, useState } from 'react';
import { calculateConfidence, type ConfidenceScore } from '@/lib/utils';

interface ConfidenceMeterProps {
  liquidity: number;
  volume: number;
  compact?: boolean;
  className?: string;
}

export function ConfidenceMeter({ liquidity, volume, compact = false, className = '' }: ConfidenceMeterProps) {
  const [confidence, setConfidence] = useState<ConfidenceScore>(() =>
    calculateConfidence(liquidity, volume)
  );

  useEffect(() => {
    setConfidence(calculateConfidence(liquidity, volume));
  }, [liquidity, volume]);

  const barWidth = `${Math.max(confidence.score, 2)}%`;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: barWidth,
              background: `linear-gradient(90deg, ${confidence.color}99, ${confidence.color})`,
              boxShadow: `0 0 8px ${confidence.color}40`,
            }}
          />
        </div>
        <span className="text-[10px] font-semibold text-white/60 whitespace-nowrap" style={{ color: confidence.color }}>
          {confidence.level}
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
          Confidence
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold transition-colors duration-500"
            style={{ color: confidence.color }}
          >
            {confidence.score}%
          </span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all duration-500"
            style={{
              color: confidence.color,
              backgroundColor: `${confidence.color}15`,
              border: `1px solid ${confidence.color}30`,
            }}
          >
            {confidence.level}
          </span>
        </div>
      </div>
      <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: barWidth,
            background: `linear-gradient(90deg, ${confidence.color}66, ${confidence.color})`,
            boxShadow: `0 0 10px ${confidence.color}40`,
          }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-white/25">
        <span>Low confidence</span>
        <span>High confidence</span>
      </div>
    </div>
  );
}
