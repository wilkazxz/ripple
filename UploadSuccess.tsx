import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Kind = "ok" | "del";

function Toast({ text, kind }: { text: string; kind: Kind }) {
  return (
    <div className="ok-backdrop" role="status" aria-live="polite">
      <div className={`ok-card ok-card--${kind}`}>
        <span className="ok-ripple" />
        <span className="ok-ripple ok-ripple--2" />
        <svg className="ok-svg" viewBox="0 0 52 52" aria-hidden="true">
          <circle className="ok-circle" cx="26" cy="26" r="23" fill="none" />
          {kind === "ok" ? (
            <path className="ok-mark" fill="none" d="M15 27.5l8 8 15-17" />
          ) : (
            <path className="ok-mark" fill="none" d="M17 17l18 18M35 17L17 35" />
          )}
        </svg>
        <strong>{text}</strong>
      </div>
    </div>
  );
}

/** Pakai: const { show, node } = useSuccess(); show("Berhasil terupload"); lalu render {node} */
export function useSuccess(): { show: (text: string, kind?: Kind) => void; node: ReactNode } {
  const [state, setState] = useState<{ id: number; text: string; kind: Kind } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((text: string, kind: Kind = "ok") => {
    window.clearTimeout(timer.current);
    setState({ id: Date.now(), text, kind });
    timer.current = window.setTimeout(() => setState(null), 2300);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { show, node: state ? <Toast key={state.id} text={state.text} kind={state.kind} /> : null };
}
