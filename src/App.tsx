import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Insets } from "./lib/platformGeometry";

const cssNumber = (name: string) =>
  Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

function readInsets(): Insets {
  return {
    top: cssNumber("--safe-top"),
    right: cssNumber("--safe-right"),
    bottom: cssNumber("--safe-bottom"),
    left: cssNumber("--safe-left"),
  };
}

function Diagnostics() {
  const [tick, setTick] = useState(0);
  const [nativeStatus, setNativeStatus] = useState("Not checked");

  useEffect(() => {
    const refresh = () => setTick((value) => value + 1);
    window.addEventListener("resize", refresh);
    window.addEventListener("native-insets-changed", refresh);
    window.visualViewport?.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("native-insets-changed", refresh);
      window.visualViewport?.removeEventListener("resize", refresh);
    };
  }, []);

  const info = useMemo(() => {
    void tick;
    const insets = readInsets();
    return [
      ["viewport", `${window.innerWidth} × ${window.innerHeight}`],
      ["visual viewport", window.visualViewport ? `${Math.round(window.visualViewport.width)} × ${Math.round(window.visualViewport.height)}` : "unavailable"],
      ["devicePixelRatio", String(window.devicePixelRatio)],
      ["safe top", `${insets.top.toFixed(1)}px`],
      ["safe right", `${insets.right.toFixed(1)}px`],
      ["safe bottom", `${insets.bottom.toFixed(1)}px`],
      ["safe left", `${insets.left.toFixed(1)}px`],
      ["coarse pointer", matchMedia("(pointer: coarse)").matches ? "yes" : "no"],
      ["hover", matchMedia("(hover: hover)").matches ? "yes" : "no"],
    ];
  }, [tick]);

  const checkNative = async () => {
    try {
      const value = await invoke<string>("runtime_probe");
      setNativeStatus(value);
    } catch {
      setNativeStatus("Browser preview (Tauri invoke unavailable)");
    }
  };

  return (
    <section className="diagnostics" aria-labelledby="diagnostics-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Built-in conformance check</p>
          <h2 id="diagnostics-title">Platform diagnostics</h2>
        </div>
        <button onClick={() => void checkNative()}>Probe native runtime</button>
      </div>
      <div className="diagnostic-grid">
        {info.map(([label, value]) => (
          <div className="diagnostic" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        <div className="diagnostic diagnostic-wide">
          <span>Tauri bridge</span>
          <strong>{nativeStatus}</strong>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Tauri Vibe Template</p>
          <h1>Start with the platform work already done.</h1>
        </div>
        <button className="corner-button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          Edge menu
        </button>
        {menuOpen && (
          <div className="corner-menu">
            <button onClick={() => setMenuOpen(false)}>Top-right item</button>
            <button onClick={() => setMenuOpen(false)}>Another action</button>
          </div>
        )}
      </header>

      <main className="main-scroll">
        <section className="hero-card">
          <div>
            <span className="pill">Desktop</span>
            <span className="pill">Android</span>
            <span className="pill">Library-ready</span>
          </div>
          <p>
            This starter deliberately exercises full-height scrolling, edge controls, touch targets,
            overlays, and keyboard input—the places where WebView apps most often regress.
          </p>
        </section>

        <Diagnostics />

        <section className="keyboard-card">
          <div>
            <p className="eyebrow">IME / keyboard test</p>
            <h2>Focus this field on a phone</h2>
            <p>The bottom action stays above the keyboard because Android IME clearance is folded into the safe bottom inset.</p>
          </div>
          <label>
            Sample input
            <input type="text" placeholder="Open the keyboard…" />
          </label>
        </section>
      </main>

      <footer className="bottom-bar">
        <span>Nothing important should live under a system bar.</span>
        <button>Bottom-edge action</button>
      </footer>
    </div>
  );
}
