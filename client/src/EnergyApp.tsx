import React, { useState } from "react";
import { useAppStore } from "./store/useAppStore";
import DevicePicker from "./components/DevicePicker";
import Cards from "./components/Cards";
import ChartPanel from "./components/ChartPanel";
import CalendarPicker from "./components/CalendarPicker";

export default function EnergyApp() {
  const [currentPage, setCurrentPage] = useState<"devices" | "dashboard" | "energy">("devices");
  const { devices, setDevices, selection } = useAppStore();
  const [error, setError] = useState("");

  // Load devices on mount
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/devices");
        const j = await r.json();
        const list = j?.result?.list || j?.result || j || [];
        setDevices(list);
      } catch (e) { setError(String(e)); }
    })();
  }, [setDevices]);

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
        {currentPage === "devices" && <DevicesPage devices={devices} error={error} />}
        {currentPage === "dashboard" && <DashboardPage selection={selection} />}
        {currentPage === "energy" && <EnergyPage selection={selection} />}
      </main>
      <footer>Read-only • Asia/Kolkata</footer>
    </div>
  );
}

function DevicesPage({ devices, error }: { devices: any[], error: string }) {
  return (
    <div className="page">
      <h2>Devices</h2>
      {error && <p className="err">{error}</p>}
      <DevicePicker />
    </div>
  );
}

function DashboardPage({ selection }: { selection: string[] }) {
  const [data, setData] = React.useState(null);
  const [live, setLive] = React.useState(null);
  const [error, setError] = React.useState("");

  // today & past30
  React.useEffect(() => {
    if (!selection.length) return;
    const ids = selection.join(",");
    fetch(`/api/summary?deviceIds=${encodeURIComponent(ids)}`)
      .then(r => r.json()).then(setData).catch(e => setError(String(e)));
  }, [selection]);

  // live refresh ~5s (like Tapo)
  React.useEffect(() => {
    if (selection.length !== 1) { setLive(null); return; }
    const id = selection[0];
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
  }, [selection]);

  return (
    <div className="page">
      <h2>Dashboard</h2>
      {!selection.length && <p>Select at least one device on Devices page.</p>}
      {error && <p className="err">{error}</p>}
      <Cards data={data} live={live} />
    </div>
  );
}

function EnergyPage({ selection }: { selection: string[] }) {
  const [gran, setGran] = React.useState<"day" | "month" | "year">("day");
  const [range, setRange] = React.useState(() => {
    const end = new Date();
    const start = new Date(end); 
    start.setDate(end.getDate() - 1);
    return { start, end };
  });
  const [resp, setResp] = React.useState(null);
  const [error, setError] = React.useState("");

  const q = React.useMemo(() => {
    const ids = selection.join(",");
    return `/api/series?deviceIds=${encodeURIComponent(ids)}&granularity=${gran}&start=${range.start.toISOString()}&end=${range.end.toISOString()}`;
  }, [selection, gran, range]);

  React.useEffect(() => {
    if (!selection.length) return;
    fetch(q).then(r => r.json()).then(setResp).catch(e => setError(String(e)));
  }, [q, selection]);

  const toCSV = (resp: any) => {
    if (!resp?.combined) return "t,kWh\n";
    const rows = resp.combined.map((p: any) => `${p.t},${p.kWh ?? 0}`);
    return "t,kWh\n" + rows.join("\n");
  };

  return (
    <div className="page">
      <h2>Energy Usage</h2>
      {!selection.length && <p>Select at least one device on Devices page.</p>}
      <div className="toolbar">
        <div className="seg">
          <button className={gran==="day"?"on":""} onClick={()=>setGran("day")}>Day</button>
          <button className={gran==="month"?"on":""} onClick={()=>setGran("month")}>Month</button>
          <button className={gran==="year"?"on":""} onClick={()=>setGran("year")}>Year</button>
        </div>
        <CalendarPicker range={range} onChange={setRange} />
        <a id="export" download="energy.csv" href={"data:text/csv;charset=utf-8," + encodeURIComponent(toCSV(resp))}>Export CSV</a>
      </div>
      {error && <p className="err">{error}</p>}
      <ChartPanel resp={resp} gran={gran} />
    </div>
  );
}