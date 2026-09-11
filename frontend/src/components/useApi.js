import { useEffect, useState } from "react";

// Small hook so every page handles loading and failure the same way. Keeps the
// previous data while refetching, so a refresh never flashes an empty page.
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState((s) => ({ ...s, error, loading: false })));
    return () => { alive = false; };
  }, deps);

  return state;
}
