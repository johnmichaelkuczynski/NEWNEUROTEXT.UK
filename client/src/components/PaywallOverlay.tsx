import { Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface PaywallOverlayProps {
  totalWords: number;
  visibleWords: number;
  percentageShown: number;
}

export function PaywallOverlay({ totalWords, visibleWords, percentageShown }: PaywallOverlayProps) {
  const { user } = useAuth();
  
  const handleBuyCredits = async () => {
    if (!user) {
      sessionStorage.setItem('redirectAfterLogin', 'stripe-checkout');
      window.location.href = '/api/login';
      return;
    }
    
    try {
      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.ok) {
        const { url } = await response.json();
        if (url) {
          window.location.href = url;
        }
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
    }
  };
  
  const hiddenWords = totalWords - visibleWords;
  
  const buttonStyle: React.CSSProperties = {
    backgroundColor: '#000000',
    color: '#FFFFFF',
    opacity: 1,
    fontWeight: 900,
    fontSize: '18px',
    padding: '18px 44px',
    borderRadius: '9999px',
    border: '4px solid #FFFFFF',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    display: 'inline-block',
    textDecoration: 'none',
    boxShadow: '0 0 0 3px #000000, 0 4px 20px rgba(0,0,0,0.5)',
    pointerEvents: 'auto',
    WebkitTextFillColor: '#FFFFFF',
    filter: 'none',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };
  
  return (
    <div style={{ position: 'relative', marginTop: '16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{
        background: 'linear-gradient(to bottom, #fffbeb, #fff7ed)',
        border: '3px solid #fbbf24',
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'center',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <div style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '50%' }}>
            <Lock style={{ width: '32px', height: '32px', color: '#d97706' }} />
          </div>
        </div>
        
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
          Content Preview
        </h3>
        
        <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>
          You're seeing <span style={{ fontWeight: 600, color: '#d97706' }}>{percentageShown}%</span> of this content ({visibleWords.toLocaleString()} of {totalWords.toLocaleString()} words).
          <br />
          <span style={{ fontWeight: 500 }}>{hiddenWords.toLocaleString()} words</span> are hidden.
        </p>
        
        <button
          type="button"
          onClick={handleBuyCredits}
          style={buttonStyle}
          data-testid="button-buy-credits-paywall"
        >
          BUY CREDITS TO SEE FULL CONTENT
        </button>
        
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '12px' }}>
          $100 = 1,000 credits. Credits are used based on AI model selected.
        </p>
      </div>
    </div>
  );
}
