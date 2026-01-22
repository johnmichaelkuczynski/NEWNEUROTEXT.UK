import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Download, X, Loader2, CheckCircle2, GripHorizontal, Minimize2, Maximize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StreamChunk {
  type: 'section_complete' | 'progress' | 'outline' | 'complete';
  sectionTitle?: string;
  chunkText?: string;
  sectionIndex?: number;
  totalChunks?: number;
  progress?: number;
  stage?: string;
  wordCount?: number;
  totalWordCount?: number;
}

interface StreamingOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (finalText: string) => void;
  startNew?: boolean;
}

export function StreamingOutputModal({ isOpen, onClose, onComplete, startNew = false }: StreamingOutputModalProps) {
  const [content, setContent] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState<string>('');
  const [sectionsCompleted, setSectionsCompleted] = useState(0);
  const [totalSections, setTotalSections] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<string>('');
  const hasStartedRef = useRef(false);
  const wordCountRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (panelRef.current) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y))
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const clearContent = useCallback(() => {
    setContent('');
    contentRef.current = '';
    wordCountRef.current = 0;
    setProgress(0);
    setCurrentSection('Connecting...');
    setSectionsCompleted(0);
    setTotalSections(0);
    setWordCount(0);
    setIsComplete(false);
    setCopied(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (startNew && !hasStartedRef.current) {
      clearContent();
      hasStartedRef.current = true;
    }
    
    setCurrentSection('Connecting...');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/cc-stream`;
    
    console.log('[StreamingModal] Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[StreamingModal] WebSocket connected');
      setCurrentSection('Waiting for generation to start...');
    };

    ws.onmessage = (event) => {
      try {
        const data: StreamChunk = JSON.parse(event.data);
        console.log('[StreamingModal] Received:', data.type);

        switch (data.type) {
          case 'outline':
            setCurrentSection('Outline generated, starting sections...');
            if (data.totalChunks) {
              setTotalSections(data.totalChunks);
            }
            break;

          case 'section_complete':
            if (data.chunkText) {
              setContent(prev => {
                const newContent = prev ? prev + '\n\n' + data.chunkText : data.chunkText || '';
                contentRef.current = newContent;
                return newContent;
              });
            }
            if (data.sectionTitle) {
              setCurrentSection(`Completed: ${data.sectionTitle}`);
            }
            if (data.sectionIndex !== undefined) {
              setSectionsCompleted(data.sectionIndex + 1);
            }
            if (data.totalChunks) {
              setTotalSections(data.totalChunks);
            }
            if (data.progress !== undefined) {
              setProgress(data.progress);
            }
            if (data.totalWordCount !== undefined) {
              wordCountRef.current = data.totalWordCount;
              setWordCount(data.totalWordCount);
            }
            setTimeout(scrollToBottom, 100);
            break;

          case 'complete':
            setIsComplete(true);
            setProgress(100);
            setCurrentSection('Generation complete!');
            if (data.totalWordCount !== undefined) {
              wordCountRef.current = data.totalWordCount;
              setWordCount(data.totalWordCount);
            }
            toast({
              title: "Generation Complete",
              description: `${data.totalWordCount?.toLocaleString() || wordCountRef.current.toLocaleString()} words generated successfully.`,
            });
            break;
        }
      } catch (err) {
        console.error('[StreamingModal] Parse error:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('[StreamingModal] WebSocket error:', error);
      setCurrentSection('Connection error - check console');
    };

    ws.onclose = () => {
      console.log('[StreamingModal] WebSocket closed');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [isOpen, toast, scrollToBottom, startNew, clearContent]);

  useEffect(() => {
    if (!startNew) {
      hasStartedRef.current = false;
    }
  }, [startNew]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Content copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleSave = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurotext-output-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Saved!",
      description: "File downloaded successfully.",
    });
  };

  const handleClose = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    if (isComplete && content && onComplete) {
      onComplete(content);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-background border rounded-lg shadow-xl flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? '350px' : '800px',
        height: isMinimized ? 'auto' : '500px',
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 40px)',
      }}
      data-testid="streaming-output-panel"
    >
      {/* Draggable header */}
      <div
        className="flex items-center justify-between gap-2 p-3 border-b cursor-move select-none bg-muted/50 rounded-t-lg"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          )}
          <span className="font-medium text-sm truncate">
            {isComplete ? 'Complete' : 'Generating...'}
          </span>
          {!isMinimized && (
            <span className="text-xs text-muted-foreground">
              {sectionsCompleted}/{totalSections} sections
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
            disabled={!content}
            data-testid="button-copy-stream"
          >
            {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleSave}
            disabled={!content}
            data-testid="button-save-stream"
          >
            <Download className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
            data-testid="button-minimize-stream"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleClose}
            data-testid="button-close-stream"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex flex-col gap-2 p-3 border-b">
            <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <span className="truncate">{currentSection}</span>
              <span className="flex-shrink-0">
                {wordCount > 0 && `${wordCount.toLocaleString()} words`}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <ScrollArea className="flex-1 p-4">
            <div ref={scrollRef} className="whitespace-pre-wrap font-mono text-sm">
              {content || (
                <span className="text-muted-foreground italic">
                  Waiting for content... The document will appear here section by section as it is generated.
                </span>
              )}
            </div>
          </ScrollArea>
        </>
      )}

      {isMinimized && (
        <div className="p-2 text-xs text-muted-foreground">
          <Progress value={progress} className="h-1 mb-1" />
          {wordCount > 0 && `${wordCount.toLocaleString()} words`}
        </div>
      )}
    </div>
  );
}
