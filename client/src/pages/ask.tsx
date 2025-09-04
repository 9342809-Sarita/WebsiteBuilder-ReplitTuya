import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Send, 
  Brain, 
  AlertCircle,
  ArrowLeft,
  Loader2
} from "lucide-react";
import { Link } from "wouter";

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleAsk = async () => {
    if (!question.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question before asking",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError("");
    setAnswer("");

    try {
      const url = new URL("/api/ask", window.location.origin);
      url.searchParams.set("q", question.trim());
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || "Ask AI failed");
      }
      
      setAnswer(data.answer);
      toast({
        title: "Question Answered",
        description: "AI has analyzed your question and provided a response",
      });
    } catch (err: any) {
      const errorMessage = String(err);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isLoading) {
      handleAsk();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <Brain className="text-primary-foreground h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Ask AI</h1>
                <p className="text-sm text-muted-foreground">Get insights about your smart devices</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>Ask Questions About Your Devices</span>
            </CardTitle>
            <CardDescription>
              Ask questions about your smart devices and get AI-powered insights. 
              For example: "Which devices are currently online?" or "Show me the status of all my smart plugs."
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Question Input */}
            <div className="space-y-2">
              <label htmlFor="question" className="text-sm font-medium">
                Your Question
              </label>
              <Textarea
                id="question"
                data-testid="input-question"
                rows={4}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me about your devices... (e.g., 'Which plug is using the most power?' or 'Show me all offline devices')"
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Press Ctrl+Enter (Cmd+Enter on Mac) to send your question
              </p>
            </div>

            {/* Ask Button */}
            <Button 
              onClick={handleAsk} 
              disabled={isLoading || !question.trim()}
              className="w-full"
              data-testid="button-ask"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Ask AI
                </>
              )}
            </Button>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription data-testid="error-message">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Answer Display */}
            {answer && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Brain className="h-4 w-4" />
                    <span>AI Response</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <pre 
                      className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed"
                      data-testid="ai-answer"
                    >
                      {answer}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Usage Examples */}
            {!answer && !error && (
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Example Questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Which devices are currently online?",
                      "Show me all my smart plugs",
                      "What types of devices do I have?", 
                      "List devices that are offline",
                      "Which device has been active the longest?"
                    ].map((example, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setQuestion(example)}
                        data-testid={`example-${idx}`}
                      >
                        {example}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Click on any example to use it as your question
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}