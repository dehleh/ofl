import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  MessageSquare, 
  RefreshCw, 
  ChevronDown, 
  ShieldCheck, 
  Cpu, 
  ArrowRight,
  TrendingUp,
  HelpCircle
} from 'lucide-react';
import { API_BASE, getAuthHeaders } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  timestamp: string;
}

interface CreditCopilotDrawerProps {
  currentPersona: string;
  selectedCaseId?: string | null;
}

export const CreditCopilotDrawer: React.FC<CreditCopilotDrawerProps> = ({
  currentPersona,
  selectedCaseId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello ${currentPersona}, I am your Opticom Credit AI Copilot. Ask me about credit policy benchmarks, ratio analysis (DSCR/ICR), 28% APR vs 23% MPR, or request a risk synthesis of your active case.`,
      provider: 'Google Cloud Vertex AI (Gemini)',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          message: text,
          case_id: selectedCaseId || null,
          persona: currentPersona,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!res.ok) throw new Error('Copilot service unavailable');
      const data = await res.json();

      const botMsg: Message = {
        role: 'assistant',
        content: data.reply || 'Underwriting analysis completed.',
        provider: data.provider || 'Opticom Credit Copilot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        role: 'assistant',
        content: 'Unable to reach the Vertex AI service. Please verify network connectivity.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const suggestionChips = [
    'Summarize credit risk for active case',
    'What are Opticom DSCR and ratio limits?',
    'Is 23% MPR the same as 28% APR?',
    'What are the approval limits for HRM and MD?'
  ];

  return (
    <>
      {/* Floating Trigger Button in Bottom Right */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9990,
            background: 'linear-gradient(135deg, #0096cc 0%, #006b99 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '9999px',
            padding: '0.85rem 1.35rem',
            boxShadow: '0 10px 25px -3px rgba(0, 150, 204, 0.45), 0 4px 6px -4px rgba(0, 150, 204, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: 700,
            fontFamily: 'var(--font-sans)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
          }}
        >
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={18} />
          </div>
          <span>AI Underwriter Copilot</span>
          <span style={{
            fontSize: '0.65rem',
            background: 'rgba(255, 255, 255, 0.25)',
            padding: '0.15rem 0.45rem',
            borderRadius: '9999px',
            fontFamily: 'var(--font-mono)'
          }}>
            GEMINI
          </span>
        </button>
      )}

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '420px',
          maxWidth: 'calc(100vw - 32px)',
          height: '620px',
          maxHeight: 'calc(100vh - 48px)',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 20px 45px -5px rgba(15, 23, 42, 0.25), 0 8px 16px -6px rgba(15, 23, 42, 0.1)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Drawer Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0096cc 0%, #007ba8 100%)',
            color: '#ffffff',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bot size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
                  Opticom Credit AI Copilot
                </div>
                <div style={{ fontSize: '0.72rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>Vertex AI Gemini</span>
                  {selectedCaseId && (
                    <span>&bull; Case: <code style={{ color: '#e0f2fe' }}>{selectedCaseId}</code></span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                cursor: 'pointer'
              }}
              title="Close Copilot"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick Context Strip */}
          <div style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '0.5rem 1rem',
            fontSize: '0.72rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>Persona: <strong style={{ color: '#0096cc' }}>{currentPersona}</strong></span>
            <span>Policy: <strong>CBN MPR + 5% (28% APR)</strong></span>
          </div>

          {/* Messages Feed */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            background: '#ffffff'
          }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  maxWidth: '88%',
                  padding: '0.75rem 1rem',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user' ? '#0096cc' : '#f1f5f9',
                  color: m.role === 'user' ? '#ffffff' : '#0f172a',
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </div>
                </div>

                <div style={{
                  fontSize: '0.65rem',
                  color: '#94a3b8',
                  marginTop: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <span>{m.timestamp}</span>
                  {m.provider && (
                    <span style={{ color: '#0096cc', fontWeight: 600 }}>&bull; {m.provider}</span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0096cc', fontSize: '0.78rem', padding: '0.5rem' }}>
                <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                <span>AI Underwriter synthesizing credit rationale...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion Chips */}
          <div style={{
            padding: '0.5rem 0.75rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '0.4rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            {suggestionChips.map((chip, i) => (
              <button
                key={i}
                onClick={() => handleSend(chip)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '9999px',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.72rem',
                  color: '#334155',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Box Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '0.75rem 1rem',
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <input
              type="text"
              placeholder="Ask credit copilot anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{
                flex: 1,
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn btn-primary"
              style={{
                padding: '0.65rem 0.95rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: input.trim() ? 1 : 0.6
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

