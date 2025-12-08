'use client';

import React, { useMemo } from 'react';
import type { MorphemeToken } from '@/lib/kagomeUtils';

interface MorphemeDisplayProps {
  tokens: MorphemeToken[];
  className?: string;
  showReading?: boolean;
}

const POS_COLORS: Record<string, string> = {
  '名詞': 'text-blue-300',
  '動詞': 'text-green-300',
  '形容詞': 'text-yellow-300',
  '副詞': 'text-purple-300',
  '助詞': 'text-gray-400',
  '助動詞': 'text-gray-400',
  '接続詞': 'text-pink-300',
  '連体詞': 'text-orange-300',
  '感動詞': 'text-red-300',
  '記号': 'text-gray-500',
  'フィラー': 'text-gray-400',
};

const DEFAULT_COLOR = 'text-white';

export default function MorphemeDisplay({ 
  tokens, 
  className = '',
  showReading = false 
}: MorphemeDisplayProps) {
  const renderedTokens = useMemo(() => {
    return tokens.map((token, index) => {
      const color = POS_COLORS[token.posType] || DEFAULT_COLOR;
      
      return (
        <span
          key={`${token.start}-${index}`}
          className={`${color} transition-colors hover:opacity-80`}
          title={`${token.pos}${token.baseForm ? ` (${token.baseForm})` : ''}`}
        >
          {token.surface}
          {showReading && token.reading && token.reading !== token.surface && (
            <ruby>
              <rt className="text-xs opacity-70">{token.reading}</rt>
            </ruby>
          )}
        </span>
      );
    });
  }, [tokens, showReading]);

  return (
    <span className={className}>
      {renderedTokens}
    </span>
  );
}
