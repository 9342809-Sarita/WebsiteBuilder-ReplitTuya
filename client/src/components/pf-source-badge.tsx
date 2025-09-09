import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getAppSettings } from "@/lib/api";

interface PfSourceBadgeProps {
  className?: string;
  size?: "sm" | "xs";
}

export function PfSourceBadge({ className, size = "xs" }: PfSourceBadgeProps) {
  const { data: settings } = useQuery({
    queryKey: ["/api/app-settings"],
    queryFn: getAppSettings,
    staleTime: 30000, // Consider fresh for 30 seconds
  });

  const pfSource = settings?.pfSource || "calculated";
  const isCalculated = pfSource === "calculated";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="secondary" 
          className={`
            ${size === "xs" ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-1"} 
            ${isCalculated 
              ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300" 
              : "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300"
            } 
            ${className}
          `}
        >
          PF: {isCalculated ? "Calc" : "Tuya"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">
          {isCalculated 
            ? "Power Factor calculated from P/(V×A)" 
            : "Power Factor from direct Tuya readings"
          }
        </p>
      </TooltipContent>
    </Tooltip>
  );
}