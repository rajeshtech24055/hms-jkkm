import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';

export default function ChatbotBubble() {
  const { user, api } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Only show the chatbot for students
  if (!user || user.role !== 'STUDENT') return null;

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      fetchHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const data = await api('/api/chat');
      setMessages(data);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await api('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMessage.content }),
      });
      setMessages((prev) => [...prev, res]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: 'Oops! I ran into an error connecting to the server.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      {isOpen ? (
        <div style={{ 
          width: 350, height: 500, background: '#fff', borderRadius: 16, 
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border)', overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ 
            background: 'linear-gradient(135deg, var(--primary), #818cf8)', 
            color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
              <div>
                <div style={{ fontWeight: 600 }}>Hostel AI Assistant</div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>Online</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 40 }}>
                Ask me about the menu or your leave status!
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={idx} style={{ 
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: msg.role === 'user' ? 'var(--primary)' : '#fff',
                color: msg.role === 'user' ? '#fff' : 'var(--text-main)',
                padding: '10px 14px',
                borderRadius: 16,
                borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                borderBottomLeftRadius: msg.role === 'user' ? 16 : 4,
                boxShadow: msg.role === 'user' ? 'none' : '0 2px 8px rgba(0,0,0,0.05)',
                fontSize: 14,
                lineHeight: 1.5,
                border: msg.role === 'user' ? 'none' : '1px solid var(--border)'
              }}>
                {msg.role === 'model' ? (
                  <ReactMarkdown components={{ p: ({node, ...props}) => <div style={{margin:0}} {...props}/> }}>
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', background: '#fff', padding: '10px 14px', borderRadius: 16, fontSize: 14, border: '1px solid var(--border)' }}>
                <span className="dot-typing"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} style={{ padding: 16, background: '#fff', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input 
              type="text" 
              placeholder="Type your message..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 20, border: '1px solid var(--border)', outline: 'none', background: '#f1f5f9' }}
            />
            <button type="submit" disabled={!input.trim() || loading} style={{ 
              width: 40, height: 40, borderRadius: '50%', background: input.trim() && !loading ? 'var(--primary)' : '#cbd5e1', 
              color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading ? 'pointer' : 'default'
            }}>
              ➤
            </button>
          </form>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            width: 60, height: 60, borderRadius: '50%', background: 'var(--primary)',
            color: '#fff', fontSize: 28, border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          💬
        </button>
      )}
    </div>
  );
}
