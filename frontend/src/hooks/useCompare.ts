import { useState } from 'react';
import type { CompareRequest, CompareResponse } from '../types';

export function useCompare() {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = async (req: CompareRequest) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/api/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `エラー: ${res.status}`);
      }

      const result: CompareResponse = await res.json();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, compare };
}
