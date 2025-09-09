import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface NoDataAlertProps {
  message?: string;
}

export function NoDataAlert({ message = "No data found for this device and period. Try another device or date." }: NoDataAlertProps) {
  return (
    <Alert className="my-4">
      <Info className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}