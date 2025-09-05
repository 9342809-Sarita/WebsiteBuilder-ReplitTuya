import React, { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveNavigation } from "@/components/responsive-navigation";
import { useQuery } from "@tanstack/react-query";
import { Home, AlertCircle } from "lucide-react";

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showConnectionStatus?: boolean;
  className?: string;
}

export function PageLayout({ 
  children, 
  title = "Tuya Device Monitor", 
  subtitle = "Smart Life device monitoring system",
  showConnectionStatus = true,
  className = ""
}: PageLayoutProps) {
  // Health check query for connection status
  const { data: healthData } = useQuery({
    queryKey: ["/api/health"],
    refetchInterval: 30000, // Check health every 30 seconds
    enabled: showConnectionStatus,
  });

  const isConnected = showConnectionStatus ? (healthData as any)?.ok : undefined;

  return (
    <div className={`min-h-screen bg-background ${className}`}>
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3 min-w-0 flex-shrink-0">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <Home className="text-primary-foreground h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                  {subtitle}
                </p>
              </div>
            </div>

            {/* Navigation */}
            <ResponsiveNavigation 
              connectionStatus={showConnectionStatus && isConnected !== undefined ? {
                isConnected,
                label: isConnected ? "Connected" : "Disconnected"
              } : undefined}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Read-only monitoring • No device control • Secure API access</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Powered by Tuya OpenAPI • v1.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}