import React, { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveNavigation } from "@/components/responsive-navigation";
import { useQuery } from "@tanstack/react-query";
import { Home, AlertCircle, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string | ReactNode;
  showConnectionStatus?: boolean;
  className?: string;
  headerAction?: ReactNode;
}

export function PageLayout({ 
  children, 
  title = "Enerlytics", 
  subtitle = "Smart Life device monitoring system",
  showConnectionStatus = true,
  className = "",
  headerAction
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
              <Link href="/">
                <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg cursor-pointer hover:bg-primary/90 transition-colors">
                  <Home className="text-primary-foreground h-5 w-5" />
                </div>
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
                  {title}
                </h1>
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
        {(subtitle || headerAction) && (
          <div className="mb-4 sm:mb-6 flex items-center justify-between">
            <div>
              {subtitle && (
                typeof subtitle === 'string' ? (
                  <div className="text-sm text-muted-foreground">
                    {subtitle}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {subtitle}
                  </div>
                )
              )}
            </div>
            {headerAction && (
              <div className="flex-shrink-0">
                {headerAction}
              </div>
            )}
          </div>
        )}
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

      {/* Floating AI CHAT Button */}
      <Link href="/ask">
        <Button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50"
          size="icon"
          data-testid="floating-ai-chat"
          title="AI CHAT - Get insights about your devices"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  );
}