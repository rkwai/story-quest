import React, { useEffect, useRef } from 'react';

interface Message {
  id: number;
  author: string;
  content: string;
  timestamp: Date;
}

interface ChatDisplayProps {
  messages: Message[];
}

const ChatDisplay: React.FC<ChatDisplayProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Format timestamp
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-display">
      {messages.length === 0 ? (
        <div className="empty-chat">
          <p>Your adventure begins here. What would you like to do?</p>
        </div>
      ) : (
        messages.map((message) => (
          <div 
            key={message.id} 
            className={`message ${message.author === 'DM' ? 'dm-message' : 'player-message'}`}
          >
            <div className="message-header">
              <span className="message-author">{message.author}</span>
              <span className="message-time">{formatTime(message.timestamp)}</span>
            </div>
            <div className="message-content">
              {message.content.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatDisplay; 