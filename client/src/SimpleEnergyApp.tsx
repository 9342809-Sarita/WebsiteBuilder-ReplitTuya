import React, { useState, useEffect } from "react";

// Simple store
const useAppStore = (() => {
  const state = { devices: [] as any[], selection: [] as string[] };
  const listeners = new Set<() => void>();
  
  return () => ({
    devices: state.devices,
    selection: state.selection,
    setDevices: (devices: any[]) => {
      state.devices = Array.isArray(devices) ? devices : [];
      listeners.forEach(fn => fn());
    },
    toggle: (id: string) => {
      if (state.selection.includes(id)) {
        state.selection = state.selection.filter(x => x !== id);
      } else {
        state.selection = [...state.selection, id];
      }
      listeners.forEach(fn => fn());
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  });
})();

// Simple DevicePicker component
function DevicePicker() {
  const store = useAppStore();
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    return store.subscribe(() => forceUpdate({}));
  }, []);
  
  return (
    <div className="device-picker">
      {store.devices.map((d: any) => (
        <label key={d.id || d.device_id}>
          <input 
            type="checkbox"
            checked={store.selection.includes(d.id || d.device_id)}
            onChange={() => store.toggle(d.id || d.device_id)} 
          />
          <span>{d.name}</span>
        </label>
      ))}
      {!store.devices.length && <p>No devices found.</p>}
    </div>
  );
}

// Simple Cards component
function Cards({ data, live }: { data: any, live: any }) {
  const [rate, setRate] = useState(8.0);
  const today = data?.todayKWh || 0;
  const past30 = data?.past30DaysKWh || 0;

  return (
    <div className="cards">
      <div className="card">
        <h3>Current Power</h3>
        <p className="big">{live?.watts ?? "—"} W</p>
        <small>Auto-refresh ~5s</small>
      </div>
      <div className="card">
        <h3>Today</h3>
        <p className="big">{today.toFixed(3)} kWh</p>
        <small>Cost ≈ ₹{(today*rate).toFixed(2)}</small>
      </div>
      <div className="card">
        <h3>Past 30 Days</h3>
        <p className="big">{past30.toFixed(3)} kWh</p>
        <small>Cost ≈ ₹{(past30*rate).toFixed(2)}</small>
      </div>
      <div className="card">
        <h3>Electricity Rate</h3>
        <input 
          type="number" 
          step="0.1" 
          value={rate} 
          onChange={e => setRate(Number(e.target.value||0))} 
        />
        <small>₹/kWh</small>
      </div>
    </div>
  );
}

// Main app component
export default function SimpleEnergyApp() {
  const [currentPage, setCurrentPage] = useState<"devices" | "dashboard" | "energy">("devices");
  const store = useAppStore();
  const [, forceUpdate] = useState({});
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [live, setLive] = useState(null);

  // Subscribe to store changes
  useEffect(() => {
    return store.subscribe(() => forceUpdate({}));
  }, []);

  // Load devices on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/devices");
        const j = await r.json();
        
        // Handle API response - if there's an error, show demo devices
        if (j?.error) {
          // Demo devices for when UPSTREAM_BASE_URL is not configured
          const demoDevices = [
            { id: "demo1", name: "Smart Plug 1", device_id: "demo1" },
            { id: "demo2", name: "Smart Plug 2", device_id: "demo2" },
            { id: "demo3", name: "Energy Monitor", device_id: "demo3" }
          ];
          store.setDevices(demoDevices);
          setError("Demo mode: " + j.error);
        } else {
          const list = j?.result?.list || j?.result || j || [];
          store.setDevices(Array.isArray(list) ? list : []);
        }
      } catch (e) { 
        setError(String(e)); 
        store.setDevices([]); // Ensure devices is always an array
      }
    })();
  }, []);

  // Dashboard data effects
  useEffect(() => {
    if (!store.selection.length || currentPage !== "dashboard") return;
    const ids = store.selection.join(",");
    fetch(`/api/summary?deviceIds=${encodeURIComponent(ids)}`)
      .then(r => r.json()).then(setData).catch(e => setError(String(e)));
  }, [store.selection, currentPage]);

  // Live data effect
  useEffect(() => {
    if (store.selection.length !== 1 || currentPage !== "dashboard") { 
      setLive(null); 
      return; 
    }
    
    const id = store.selection[0];
    let timer: NodeJS.Timeout;
    
    async function pull() {
      try {
        const r = await fetch(`/api/live?deviceId=${encodeURIComponent(id)}`);
        const j = await r.json();
        setLive(j);
      } catch (e) { /* ignore one-offs */ }
      timer = setTimeout(pull, 5000);
    }
    
    pull();
    return () => timer && clearTimeout(timer);
  }, [store.selection, currentPage]);

  return (
    <div className="layout">
      <header>
        <h1>Tapo-like Energy Monitoring</h1>
        <nav>
          <button 
            className={currentPage === "devices" ? "active" : ""}
            onClick={() => setCurrentPage("devices")}
          >
            Devices
          </button>
          <button 
            className={currentPage === "dashboard" ? "active" : ""}
            onClick={() => setCurrentPage("dashboard")}
          >
            Dashboard
          </button>
          <button 
            className={currentPage === "energy" ? "active" : ""}
            onClick={() => setCurrentPage("energy")}
          >
            Energy
          </button>
        </nav>
      </header>
      
      <main>
        {currentPage === "devices" && (
          <div className="page">
            <h2>Devices</h2>
            {error && <p className="err">{error}</p>}
            <DevicePicker />
          </div>
        )}
        
        {currentPage === "dashboard" && (
          <div className="page">
            <h2>Dashboard</h2>
            {!store.selection.length && <p>Select at least one device on Devices page.</p>}
            {error && <p className="err">{error}</p>}
            <Cards data={data} live={live} />
          </div>
        )}
        
        {currentPage === "energy" && (
          <div className="page">
            <h2>Energy Usage</h2>
            {!store.selection.length && <p>Select at least one device on Devices page.</p>}
            <div className="toolbar">
              <div className="seg">
                <button className="on">Day</button>
                <button>Month</button>
                <button>Year</button>
              </div>
              <div className="cal">
                <button>◀</button>
                <span>2024-01-15 → 2024-01-16</span>
                <button>▶</button>
              </div>
              <a id="export" href="#" download="energy.csv">Export CSV</a>
            </div>
            <div className="chart">
              <p>Energy chart will be displayed here when connected to your data source.</p>
              <p>Configure UPSTREAM_BASE_URL to connect to your energy data API.</p>
            </div>
          </div>
        )}
      </main>
      
      <footer>Read-only • Asia/Kolkata</footer>
    </div>
  );
}