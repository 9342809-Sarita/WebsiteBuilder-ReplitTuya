// client/src/pages/ask.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PageLayout } from "@/components/page-layout";
import { MessageSquare, Send, Trash2, Loader2 } from "lucide-react";

type Role = "user" | "assistant";
type ChatMessage = { role: Role; content: string; ts: number };

const SID_KEY = "ask.sid.v1";
function getSessionId(): string {
  let sid = localStorage.getItem(SID_KEY);
  if (!sid) { sid = crypto.randomUUID(); localStorage.setItem(SID_KEY, sid); }
  return sid;
}

export default function AskPage() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sessionId = useMemo(getSessionId, []);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/ask/history?sessionId=${encodeURIComponent(sessionId)}`);
        const j = await r.json();
        if (j.ok) setMessages(j.history || []);
      } catch { /* ignore */ }
    })();
  }, [sessionId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ask = async () => {
    const q = input.trim();
    if (!q) return;
    setIsLoading(true);
    setInput("");

    setMessages(m => [...m, { role: "user", content: q, ts: Date.now() }]);

    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, sessionId }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Ask failed");
      setMessages(j.history || []);
    } catch (e: any) {
      toast({
        title: "Ask AI failed",
        description: e?.message || String(e),
        variant: "destructive",
      });
      setMessages(m => m.slice(0, -1)); // rollback optimistic user msg
    } finally {
      setIsLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  const clearChat = async () => {
    try {
      const r = await fetch("/api/ask/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const j = await r.json();
      if (j.ok) setMessages([]);
    } catch { /* ignore */ }
  };

  return (
    <PageLayout 
      title="Ask AI Assistant" 
      subtitle="Chat with AI about your devices and get insights"
    >
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <CardTitle className="text-lg flex items-center space-x-2">
                <MessageSquare className="h-5 w-5" />
                <span>AI Assistant</span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={clearChat}
                disabled={messages.length === 0 || isLoading}
                data-testid="button-clear-chat"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Clear Chat</span>
                <span className="sm:hidden">Clear</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            {/* Chat Messages */}
            <div 
              ref={scrollerRef} 
              className="h-[50vh] sm:h-[60vh] overflow-y-auto rounded-lg border bg-muted/30 p-3 sm:p-4 space-y-3 mb-4"
            >
              {messages.length === 0 && (
                <Alert className="border-dashed">
                  <AlertDescription className="text-sm">
                    Start a conversation below. Ask about your devices, energy usage, status, or any insights. 
                    Messages are remembered during this session.
                  </AlertDescription>
                </Alert>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-3 py-2 shadow-sm text-sm break-words ${
                    m.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-br-none" 
                      : "bg-card border border-border rounded-bl-none"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${
                        m.role === "user" 
                          ? "text-primary-foreground/70" 
                          : "text-muted-foreground"
                      }`}>
                        {m.role === "user" ? "You" : "AI"}
                      </span>
                      <span className={`text-xs ${
                        m.role === "user" 
                          ? "text-primary-foreground/50" 
                          : "text-muted-foreground/60"
                      }`}>
                        {new Date(m.ts).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-2xl rounded-bl-none px-3 py-2 shadow-sm max-w-[90%] sm:max-w-[85%]">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="space-y-3">
              <Textarea
                placeholder="Ask about your devices, energy, status, insights... (Shift+Enter for newline)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={3}
                className="resize-none text-sm sm:text-base"
                disabled={isLoading}
                data-testid="textarea-question"
              />
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
                <div className="text-xs text-muted-foreground">
                  {messages.length > 0 && (
                    <span>Session: {sessionId.slice(0, 8)}...</span>
                  )}
                </div>
                <Button 
                  onClick={ask} 
                  disabled={isLoading || input.trim().length === 0}
                  className="w-full sm:w-auto"
                  data-testid="button-send-question"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" /> 
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}