import React, { useMemo, useState } from "react";

interface CardsProps {
  data: any;
  live: any;
}

export default function Cards({ data, live }: CardsProps) {
  const [rate, setRate] = useState(8.0); // ₹/kWh default
  const today = data?.todayKWh || 0;
  const past30 = data?.past30DaysKWh || 0;

  const todayCost = useMemo(()=> (today*rate).toFixed(2), [today, rate]);
  const past30Cost = useMemo(()=> (past30*rate).toFixed(2), [past30, rate]);

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
        <small>Cost ≈ ₹{todayCost}</small>
      </div>
      <div className="card">
        <h3>Past 30 Days</h3>
        <p className="big">{past30.toFixed(3)} kWh</p>
        <small>Cost ≈ ₹{past30Cost}</small>
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