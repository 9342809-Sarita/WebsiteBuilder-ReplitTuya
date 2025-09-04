import React from "react";
import { useAppStore } from "../store/useAppStore";

export default function DevicePicker() {
  const { devices, selection, toggle } = useAppStore();
  
  return (
    <div className="device-picker">
      {devices.map((d: any) => (
        <label key={d.id || d.device_id}>
          <input 
            type="checkbox"
            checked={selection.includes(d.id || d.device_id)}
            onChange={() => toggle(d.id || d.device_id)} 
          />
          <span>{d.name}</span>
        </label>
      ))}
      {!devices.length && <p>No devices found.</p>}
    </div>
  );
}