
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, CADObject, ShapeType } from '../../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  objects: CADObject[];
  onSendMessage: (msg: string) => Promise<void>;
  onStop?: () => void;
  isLoading: boolean;
}

const getIconForType = (type: ShapeType) => {
  switch (type) {
    case ShapeType.BOX: return "📦";
    case ShapeType.SPHERE: return "⚾";
    case ShapeType.CYLINDER: return "🛢️";
    case ShapeType.CONE: return "A";
    case ShapeType.PLANE: return "⬜";
    default: return "🧊";
  }
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, objects, onSendMessage, onStop, isLoading }) => {
  const [input, setInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Filter objects based on mention query
  const filteredObjects = mentionQuery !== null 
    ? objects.filter(o => o.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    // Detect if we are typing a mention
    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt !== -1) {
        // Get text after @
        const query = textBeforeCursor.slice(lastAt + 1);
        // If query contains space, assume end of mention
        if (query.includes(' ')) {
             setMentionQuery(null);
        } else {
             setMentionQuery(query);
             setSelectedIndex(0);
        }
    } else {
        setMentionQuery(null);
    }
  };

  const insertMention = (objName: string) => {
      const cursor = inputRef.current?.selectionStart || input.length;
      const textBeforeCursor = input.slice(0, cursor);
      const lastAt = textBeforeCursor.lastIndexOf('@');
      
      if (lastAt !== -1) {
          const prefix = input.slice(0, lastAt);
          const suffix = input.slice(cursor);
          const newValue = `${prefix}@${objName} ${suffix}`;
          
          setInput(newValue);
          setMentionQuery(null);
          
          // Focus and set cursor
          setTimeout(() => {
              if (inputRef.current) {
                  inputRef.current.focus();
                  // New position: length of prefix + length of "@" + length of name + length of " "
                  const newPos = prefix.length + 1 + objName.length + 1;
                  inputRef.current.setSelectionRange(newPos, newPos);
              }
          }, 0);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (mentionQuery !== null && filteredObjects.length > 0) {
          if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredObjects.length - 1));
          } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex(prev => (prev < filteredObjects.length - 1 ? prev + 1 : 0));
          } else if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              insertMention(filteredObjects[selectedIndex].name);
          } else if (e.key === 'Escape') {
              setMentionQuery(null);
          }
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mentionQuery !== null) {
        // If menu is open, Enter selects the mention (handled in onKeyDown), 
        // but if for some reason the form submits, prevent it.
        return; 
    }
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
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Architect Intelligence</p>
        </div>
        {isLoading && onStop && (
            <button 
                onClick={onStop}
                className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs border border-red-500/50 rounded transition-colors"
            >
                Stop
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-10">
            <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                 <span className="text-2xl font-serif text-slate-400">I</span>
            </div>
            <p className="font-serif text-lg text-slate-300">IANVS</p>
            <p className="text-sm">Describe the structure you wish to build.</p>
            <div className="mt-6 flex flex-col gap-2 text-xs text-slate-400">
                <p className="bg-slate-800/50 p-2 rounded cursor-pointer hover:bg-slate-800 transition-colors">"Construct a modern coffee table"</p>
                <p className="bg-slate-800/50 p-2 rounded cursor-pointer hover:bg-slate-800 transition-colors">"Split the red box in half"</p>
                <p className="bg-slate-800/50 p-2 rounded cursor-pointer hover:bg-slate-800 transition-colors">"Move @StarterCube 2 units up"</p>
            </div>
          </div>
        )}
        
        {messages.map((msg, index) => {
          const isLastAndLoading = isLoading && index === messages.length - 1;
          
          return (
            <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
                <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                    ? 'bg-blue-700 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                }`}
                >
                {msg.thoughtProcess && (
                    <details className="mb-2 group" open={isLastAndLoading}>
                    <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-300 flex items-center gap-1 list-none select-none">
                        <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {isLastAndLoading ? 'Architecting...' : 'Show Thinking'}
                    </summary>
                    <div className="mt-2 pl-2 border-l-2 border-slate-700 text-xs text-slate-400 whitespace-pre-wrap font-mono bg-slate-900/50 p-2 rounded max-h-60 overflow-y-auto">
                        {msg.thoughtProcess}
                    </div>
                    </details>
                )}

                {msg.commands && msg.commands.length > 0 && (
                    <details className="mb-3 group" open={true}>
                    <summary className="cursor-pointer text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1 list-none select-none">
                        <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        Generated Blueprint
                    </summary>
                    <div className="mt-2 p-2 bg-slate-950 rounded border border-slate-700 overflow-x-auto">
                        <pre className="text-[10px] text-green-400 font-mono leading-tight">
                        {JSON.stringify(msg.commands, null, 2)}
                        </pre>
                    </div>
                    </details>
                )}
                
                <div className="whitespace-pre-wrap">
                    {msg.content.split(/(@\w+)/g).map((part, i) => 
                        part.startsWith('@') 
                        ? <span key={i} className="text-yellow-300 font-medium">{part}</span> 
                        : part
                    )}
                </div>
                </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-700 flex gap-1 items-center">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-800 relative">
        {/* Suggestion Box */}
        {mentionQuery !== null && filteredObjects.length > 0 && (
            <div className="absolute bottom-full left-4 mb-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-50">
                <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-700 text-xs text-slate-400 font-medium">
                    Suggestions
                </div>
                <div className="max-h-48 overflow-y-auto">
                    {filteredObjects.map((obj, idx) => (
                        <button
                            key={obj.id}
                            onClick={() => insertMention(obj.name)}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                idx === selectedIndex 
                                ? 'bg-blue-600 text-white' 
                                : 'text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            <span>{getIconForType(obj.type)}</span>
                            <span className="truncate">{obj.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type @ to tag objects..."
            className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-800 transition-all border border-slate-700"
            disabled={isLoading}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
