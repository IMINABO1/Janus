// frontend/components/ChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, CADObject } from '../../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  objects: CADObject[];
  onSendMessage: (msg: string) => Promise<void>;
  onStop?: () => void;
  isLoading: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-96 shadow-xl relative">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex justify-between items-center">
        <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 font-serif">
            <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400 animate-ping' : 'bg-blue-500'}`}></span>
            IANVS
            </h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Parametric Engine</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-10">
            <p className="font-serif text-lg text-slate-300">Ready.</p>
            <p className="text-sm">Enter instructions to modify the script.</p>
          </div>
        )}
        
        {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user' ? 'bg-blue-700 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                }`}>
                    <p className="whitespace-pre-wrap mb-2">{msg.content}</p>
                    {msg.code && (
                        <div className="mt-2 p-2 bg-black/50 rounded border border-slate-700 overflow-x-auto">
                            <code className="text-[10px] font-mono text-green-400 whitespace-pre">
                                {msg.code}
                            </code>
                        </div>
                    )}
                </div>
            </div>
        ))}
        
        {isLoading && (
            <div className="flex justify-start">
               <span className="text-xs text-slate-500 animate-pulse">Generating geometry script...</span>
            </div>
        )}
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="E.g. Cut a hole in the box..."
            className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-700"
            disabled={isLoading}
          />
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
