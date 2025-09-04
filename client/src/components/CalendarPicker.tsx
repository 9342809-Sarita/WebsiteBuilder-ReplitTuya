import React from "react";

interface CalendarPickerProps {
  range: { start: Date; end: Date };
  onChange: (range: { start: Date; end: Date }) => void;
}

export default function CalendarPicker({ range, onChange }: CalendarPickerProps) {
  const addDays = (n: number) => {
    const start = new Date(range.start);
    const end = new Date(range.end);
    start.setDate(start.getDate() + n); 
    end.setDate(end.getDate() + n);
    onChange({ start, end });
  };
  
  return (
    <div className="cal">
      <button onClick={() => addDays(-1)}>◀</button>
      <span>{range.start.toISOString().slice(0,10)} → {range.end.toISOString().slice(0,10)}</span>
      <button onClick={() => addDays(1)}>▶</button>
    </div>
  );
}