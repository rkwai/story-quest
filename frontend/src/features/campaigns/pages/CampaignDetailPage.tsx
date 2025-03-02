import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import axios from 'axios';

interface Character {
  id: number;
  name: string;
  class: string;
  level: number;
  attributes: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
}

interface StoryPost {
  id: number;
  campaign_id: number;
  content: string;
  type: 'dm' | 'player';
  created_at: string;
}

interface Campaign {
  id: number;
  name: string;
  description: string;
  theme: string;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
}

const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [storyPosts, setStoryPosts] = useState<StoryPost[]>([]);
  const [playerResponse, setPlayerResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [responseLoading, setResponseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);

  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const fetchCampaignData = async () => {
      try {
        // Fetch campaign details
        const campaignRes = await axios.get(`/api/campaigns/${id}`);
        setCampaign(campaignRes.data);
        
        // Fetch characters for this campaign
        const charactersRes = await axios.get(`/api/campaigns/${id}/characters`);
        setCharacters(charactersRes.data);
        
        if (charactersRes.data.length > 0) {
          setActiveCharacter(charactersRes.data[0]);
        }
        
        // Fetch story posts
        const storyRes = await axios.get(`/api/campaigns/${id}/story-posts`);
        setStoryPosts(storyRes.data);
        
        // If there are no story posts, generate an introduction
        if (storyRes.data.length === 0) {
          try {
            const introRes = await axios.post(`/api/campaigns/${id}/introduction`);
            setStoryPosts([introRes.data]);
          } catch (introErr) {
            console.error('Failed to generate introduction:', introErr);
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load campaign data');
        setLoading(false);
      }
    };

    fetchCampaignData();
  }, [id]);

  const handleCharacterSelect = (character: Character) => {
    setActiveCharacter(character);
  };

  const handlePlayerResponseChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPlayerResponse(e.target.value);
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeCharacter) {
      setError('Please select a character first');
      return;
    }
    
    if (!playerResponse.trim()) {
      setError('Please enter a response');
      return;
    }
    
    try {
      setResponseLoading(true);
      
      // Submit player response
      const playerPost = {
        campaign_id: id,
        character_id: activeCharacter.id,
        content: playerResponse,
        type: 'player'
      };
      
      const playerPostRes = await axios.post(`/api/campaigns/${id}/story-posts`, playerPost);
      setStoryPosts(prevPosts => [...prevPosts, playerPostRes.data]);
      
      // Get DM response
      const dmRes = await axios.post(`/api/campaigns/${id}/dm-response`, {
        character_id: activeCharacter.id,
        player_input: playerResponse
      });
      
      setStoryPosts(prevPosts => [...prevPosts, dmRes.data]);
      setPlayerResponse('');
      setResponseLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit response');
      setResponseLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading campaign...</div>;
  }

  if (!campaign) {
    return <div className="error">Campaign not found</div>;
  }

  return (
    <div className="campaign-detail-page">
      <div className="campaign-header">
        <h1>{campaign.name}</h1>
        <div className="campaign-meta">
          <span className={`campaign-status status-${campaign.status}`}>
            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
          </span>
          <span className="campaign-theme">Theme: {campaign.theme}</span>
        </div>
        <p className="campaign-description">{campaign.description}</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="campaign-content">
        <div className="character-selection">
          <h2>Your Characters</h2>
          {characters.length === 0 ? (
            <div className="empty-state">
              <p>You don't have any characters in this campaign.</p>
              <button 
                className="button button-primary"
                onClick={() => navigate(`/campaigns/${id}/new-character`)}
              >
                Create Character
              </button>
            </div>
          ) : (
            <>
              <div className="character-list">
                {characters.map(character => (
                  <div 
                    key={character.id} 
                    className={`character-card ${activeCharacter?.id === character.id ? 'active' : ''}`}
                    onClick={() => handleCharacterSelect(character)}
                  >
                    <h3>{character.name}</h3>
                    <p>Level {character.level} {character.class}</p>
                  </div>
                ))}
              </div>
              <button 
                className="button button-outline"
                onClick={() => navigate(`/campaigns/${id}/new-character`)}
              >
                Add Another Character
              </button>
            </>
          )}
        </div>

        <div className="story-section">
          <h2>Campaign Story</h2>
          
          <div className="story-posts">
            {storyPosts.length === 0 ? (
              <div className="empty-state">
                <p>Your adventure hasn't begun yet. Start by sending a message to the DM.</p>
              </div>
            ) : (
              storyPosts.map(post => (
                <div key={post.id} className={`story-post ${post.type}`}>
                  <div className="post-content">
                    {post.content}
                  </div>
                  <div className="post-meta">
                    <span className="post-time">
                      {new Date(post.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {activeCharacter ? (
            <form className="response-form" onSubmit={handleSubmitResponse}>
              <div className="form-group">
                <label htmlFor="playerResponse" className="form-label">
                  What would {activeCharacter.name} like to do?
                </label>
                <textarea
                  id="playerResponse"
                  className="form-control"
                  value={playerResponse}
                  onChange={handlePlayerResponseChange}
                  rows={3}
                  disabled={responseLoading}
                  placeholder="Describe your actions or what you want to say..."
                  required
                />
              </div>
              <button 
                type="submit" 
                className="button button-primary"
                disabled={responseLoading || !playerResponse.trim()}
              >
                {responseLoading ? 'Sending...' : 'Send'}
              </button>
            </form>
          ) : (
            <div className="select-character-prompt">
              <p>Please select or create a character to interact with the story.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignDetailPage; 