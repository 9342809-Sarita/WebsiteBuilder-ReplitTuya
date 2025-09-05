import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePage from "@/pages/home";
import SettingsPage from "@/pages/settings";
import RawDataPage from "@/pages/raw-data";
import AskPage from "@/pages/ask";
import ChartsPage from "@/pages/charts";
import MonitorPage from "@/pages/monitor";
import AlertsPage from "@/pages/alerts";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/settings/raw-data" component={RawDataPage} />
      <Route path="/ask" component={AskPage} />
      <Route path="/charts" component={ChartsPage} />
      <Route path="/monitor" component={MonitorPage} />
      <Route path="/alerts" component={AlertsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
