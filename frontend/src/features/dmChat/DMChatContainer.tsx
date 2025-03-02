import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import ChatInput from './ChatInput';
import ChatDisplay from './ChatDisplay';

interface Message {
  id: number;
  author: string;
  content: string;
  timestamp: Date;
}

interface DMChatContainerProps {
  campaignId: number;
}

const DMChatContainer: React.FC<DMChatContainerProps> = ({ campaignId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // @ts-ignore - We'll fix this typing later
  const { user, token } = useSelector((state) => state.auth);
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        // This would be a real API call in a complete implementation
        // const response = await axios.get(`${API_URL}/campaigns/${campaignId}/story`);
        // setMessages(response.data);
        
        // For now, we'll use mock data
        setMessages([
          {
            id: 1,
            author: 'DM',
            content: 'Welcome to the Lost Mines of Phandelver! You find yourselves on a road leading to the town of Phandalin. What would you like to do?',
            timestamp: new Date(Date.now() - 3600000),
          },
        ]);
      } catch (err: any) {
        setError(err.message || 'Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [campaignId, API_URL]);

  // Send message to DM
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    try {
      setIsLoading(true);
      
      // Add player message to chat
      const playerMessage: Message = {
        id: Date.now(),
        author: user?.username || 'Player',
        content,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, playerMessage]);

      // Send message to API
      const response = await axios.post(
        `${API_URL}/dm/response`,
        {
          userInput: content,
          campaignId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Add DM response to chat
      const dmMessage: Message = {
        id: Date.now() + 1,
        author: 'DM',
        content: response.data.response,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, dmMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      
      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now() + 1,
        author: 'System',
        content: 'Failed to get a response from the Dungeon Master. Please try again.',
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dm-chat-container">
      {error && <div className="error-message">{error}</div>}
      <ChatDisplay messages={messages} />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
};

export default DMChatContainer;