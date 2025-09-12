import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Home, BarChart3, Monitor, MessageSquare, Settings, Database, Bell, X } from "lucide-react";
import { Link, useLocation } from "wouter";

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ElementType;
  testId: string;
}

const navigationItems: NavigationItem[] = [
  { href: "/", label: "Dashboard", icon: Home, testId: "nav-home" },
  { href: "/charts", label: "Charts", icon: BarChart3, testId: "nav-charts" },
  { href: "/monitor", label: "Monitor", icon: Monitor, testId: "nav-monitor" },
  { href: "/alerts", label: "Alerts", icon: Bell, testId: "nav-alerts" },
  { href: "/ask", label: "AI CHAT", icon: MessageSquare, testId: "nav-ask" },
  { href: "/settings", label: "Poller Settings", icon: Settings, testId: "nav-settings" },
  { href: "/settings/devices", label: "Device Settings", icon: Database, testId: "nav-device-settings" },
  { href: "/settings/raw-data", label: "Raw Data", icon: Database, testId: "nav-raw-data" },
];

interface ResponsiveNavigationProps {
  className?: string;
  connectionStatus?: {
    isConnected: boolean;
    label: string;
  };
}

export function ResponsiveNavigation({ className = "", connectionStatus }: ResponsiveNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  const isActive = (href: string) => {
    return location === href || (href !== "/" && location.startsWith(href));
  };

  const NavButton = ({ item, onClick }: { item: NavigationItem; onClick?: () => void }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    
    return (
      <Link href={item.href}>
        <Button
          variant={active ? "default" : "outline"}
          size="sm"
          className={`w-full sm:w-auto justify-start ${active ? "bg-primary text-primary-foreground" : ""}`}
          onClick={onClick}
          data-testid={item.testId}
        >
          <Icon className="mr-2 h-4 w-4" />
          {item.label}
        </Button>
      </Link>
    );
  };

  return (
    <nav className={className}>
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center space-x-2">
        {navigationItems.map((item) => (
          <NavButton key={item.href} item={item} />
        ))}
        
        {connectionStatus && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground ml-4 pl-4 border-l border-border">
            <div className={`w-2 h-2 rounded-full ${connectionStatus.isConnected ? "bg-green-500" : "bg-red-500"}`} />
            <span data-testid="connection-status">{connectionStatus.label}</span>
          </div>
        )}
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center space-x-2">
        {connectionStatus && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${connectionStatus.isConnected ? "bg-green-500" : "bg-red-500"}`} />
            <span className="hidden sm:inline" data-testid="connection-status-mobile">{connectionStatus.label}</span>
          </div>
        )}
        
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" data-testid="mobile-menu-trigger">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 sm:w-80">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Navigation</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                data-testid="mobile-menu-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex flex-col space-y-2">
              {navigationItems.map((item) => (
                <NavButton
                  key={item.href}
                  item={item}
                  onClick={() => setIsOpen(false)}
                />
              ))}
              
              {connectionStatus && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground pt-4 mt-4 border-t border-border">
                  <div className={`w-2 h-2 rounded-full ${connectionStatus.isConnected ? "bg-green-500" : "bg-red-500"}`} />
                  <span data-testid="connection-status-sheet">{connectionStatus.label}</span>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}