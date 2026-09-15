import { useEffect, useRef } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import gsap from "gsap";
import Sidebar from "./components/Sidebar";
import JarvisAssistant from "./components/JarvisAssistant";
import Overview from "./pages/Overview";
import LiveMarket from "./pages/LiveMarket";
import RouteIntelligence from "./pages/RouteIntelligence";
import Anomalies from "./pages/Anomalies";
import Forecast from "./pages/Forecast";
import DataQuality from "./pages/DataQuality";
import GeoIntelligence from "./pages/GeoIntelligence";
import CpiIntelligence from "./pages/CpiIntelligence";
import ApiPortal from "./pages/ApiPortal";
import SystemHealth from "./pages/SystemHealth";

function PageTransition({ children }) {
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
      );
    }
  }, [location.pathname]);

  return <div ref={ref}>{children}</div>;
}

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 px-8 py-8 max-w-[1400px]">
        <PageTransition>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/live-market" element={<LiveMarket />} />
            <Route path="/routes" element={<RouteIntelligence />} />
            <Route path="/anomalies" element={<Anomalies />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/geo" element={<GeoIntelligence />} />
            <Route path="/cpi" element={<CpiIntelligence />} />
            <Route path="/data-quality" element={<DataQuality />} />
            <Route path="/api-portal" element={<ApiPortal />} />
            <Route path="/system-health" element={<SystemHealth />} />
          </Routes>
        </PageTransition>
      </main>
      <JarvisAssistant />
    </div>
  );
}
