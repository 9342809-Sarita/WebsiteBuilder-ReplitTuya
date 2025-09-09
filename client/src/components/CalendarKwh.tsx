import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CalendarDay {
  day: number;
  kwh: number;
  level: number;
}

interface CalendarKwhProps {
  month: string; // "YYYY-MM"
  days: CalendarDay[];
}

export function CalendarKwh({ month, days }: CalendarKwhProps) {
  const getHeatmapColor = (level: number) => {
    const colors = [
      'bg-gray-100 dark:bg-gray-800 text-gray-400',           // 0 - no data
      'bg-green-100 dark:bg-green-900 text-green-800',        // 1 - low
      'bg-green-200 dark:bg-green-800 text-green-900',        // 2 - medium-low  
      'bg-green-400 dark:bg-green-600 text-white',            // 3 - medium-high
      'bg-green-600 dark:bg-green-500 text-white'             // 4 - high
    ];
    return colors[level] || colors[0];
  };

  const formatTooltipDate = (day: number, month: string) => {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 1, day);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  };

  const buildCalendarWeeks = () => {
    type CalendarCell = CalendarDay | null;
    const weeks: CalendarCell[][] = [];
    let currentWeek: CalendarCell[] = [];
    
    // Get first day of month and its day of week
    const [year, monthNum] = month.split('-').map(Number);
    const firstDay = new Date(year, monthNum - 1, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }
    
    // Add all days of the month
    days.forEach((day) => {
      currentWeek.push(day);
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    // Fill last week if needed
    while (currentWeek.length < 7 && currentWeek.length > 0) {
      currentWeek.push(null);
    }
    if (currentWeek.some(day => day !== null)) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  const weeks = buildCalendarWeeks();

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-xs text-center font-medium text-muted-foreground">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-1">{day}</div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day, dayIndex) => (
                <div key={dayIndex} className="relative">
                  {day ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`
                            aspect-square flex flex-col items-center justify-center 
                            text-xs rounded cursor-pointer transition-all duration-200
                            hover:ring-2 hover:ring-primary hover:scale-105
                            ${getHeatmapColor(day.level)}
                          `}
                        >
                          <div className="font-medium">{day.day}</div>
                          <div className="text-[10px] opacity-80">
                            {day.kwh.toFixed(1)}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{formatTooltipDate(day.day, month)}: {day.kwh.toFixed(3)} kWh</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div className="aspect-square bg-transparent" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground pt-2">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map(level => (
            <div
              key={level}
              className={`w-3 h-3 rounded ${getHeatmapColor(level).split(' ').slice(0, 2).join(' ')}`}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </TooltipProvider>
  );
}