// 读 public 里的 JSON（地形、模拟结果、真实数据）。渲染前等它读完，再出帧。
import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

const cache = new Map<string, unknown>();

export function useData<T = any>(path: string): T | null {
  const [data, setData] = useState<T | null>(() => (cache.get(path) as T) ?? null);
  const [handle] = useState(() => (cache.has(path) ? null : delayRender(`读取 ${path}`)));
  useEffect(() => {
    if (!handle) return;
    fetch(staticFile(path))
      .then((r) => {
        if (!r.ok) throw new Error(`读不到 public/${path}`);
        return r.json();
      })
      .then((j) => {
        cache.set(path, j);
        setData(j as T);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
  }, [handle, path]);
  return data;
}
