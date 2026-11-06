import { Suspense, lazy, useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import Home from "./Home";
import { useSite } from "./site";
import "./styles.css";

const Admin = lazy(() => import("./Admin"));
const Legal = lazy(() => import("./Legal"));

function Splash({ src, onDone }: { src: string; onDone: () => void }) {
  useEffect(() => { const t = window.setTimeout(onDone, 1800); return () => window.clearTimeout(t); }, [onDone]);
  return <div className="splash-screen" onClick={onDone}><img src={src} alt="" /><div className="splash-screen__veil" /></div>;
}

export default function App() {
  const { site } = useSite();
  const [showSplash, setShowSplash] = useState(false);
  useEffect(() => {
    if (!site.splash) return;
    try {
      if (sessionStorage.getItem("wilkaxyz:splash-seen") !== "1") { setShowSplash(true); sessionStorage.setItem("wilkaxyz:splash-seen", "1"); }
    } catch { setShowSplash(true); }
  }, [site.splash]);
  return (
    <>
      {showSplash && site.splash && <Splash src={site.splash} onDone={() => setShowSplash(false)} />}
      <Suspense fallback={null}>
        <Switch>
          <Route path="/admin" component={Admin} />
          <Route path="/privacy">{() => <Legal type="privacy" />}</Route>
          <Route path="/terms">{() => <Legal type="terms" />}</Route>
          <Route component={Home} />
        </Switch>
      </Suspense>
    </>
  );
}
