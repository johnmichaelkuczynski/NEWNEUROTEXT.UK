import { useCredits } from "@/hooks/use-credits";
import { getFreemiumPreview } from "@/lib/freemiumPreview";
import { PaywallOverlay } from "./PaywallOverlay";

interface FreemiumContentProps {
  content: string;
  className?: string;
}

export function FreemiumContent({ content, className = "" }: FreemiumContentProps) {
  const { hasCredits } = useCredits();
  
  const preview = getFreemiumPreview(content, hasCredits);
  
  return (
    <div className={className}>
      <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
        {preview.visibleContent}
      </pre>
      
      {preview.isTruncated && (
        <PaywallOverlay
          totalWords={preview.totalWords}
          visibleWords={preview.visibleWords}
          percentageShown={preview.percentageShown}
        />
      )}
    </div>
  );
}
