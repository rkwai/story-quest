import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import axios from 'axios';

interface CharacterClass {
  name: string;
  description: string;
  primaryAttribute: string;
}

const CharacterCreationPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  
  const [characterName, setCharacterName] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [backstory, setBackstory] = useState('');
  const [attributes, setAttributes] = useState({
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  });
  const [pointsRemaining, setPointsRemaining] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<{ name: string; theme: string } | null>(null);

  const { user } = useSelector((state: RootState) => state.auth);

  const characterClasses: CharacterClass[] = [
    { 
      name: 'Warrior', 
      description: 'Masters of martial combat, warriors excel at physical prowess and battlefield tactics.', 
      primaryAttribute: 'strength' 
    },
    { 
      name: 'Rogue', 
      description: 'Stealthy and agile, rogues specialize in deception, traps, and precision strikes.', 
      primaryAttribute: 'dexterity' 
    },
    { 
      name: 'Mage', 
      description: 'Scholars of arcane knowledge, mages wield powerful spells to control the battlefield.', 
      primaryAttribute: 'intelligence' 
    },
    { 
      name: 'Cleric', 
      description: 'Divine agents who channel the power of their deity to heal allies and smite foes.', 
      primaryAttribute: 'wisdom' 
    },
    { 
      name: 'Bard', 
      description: 'Versatile entertainers who inspire allies and confound enemies with magical performances.', 
      primaryAttribute: 'charisma' 
    }
  ];

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const res = await axios.get(`/api/campaigns/${campaignId}`);
        setCampaign(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load campaign information');
      }
    };

    fetchCampaign();
  }, [campaignId]);

  const handleAttributeChange = (attribute: string, increment: boolean) => {
    // Don't allow attributes below 8 or above 18
    const currentValue = attributes[attribute as keyof typeof attributes];
    
    if (increment) {
      if (pointsRemaining <= 0) return;
      if (currentValue >= 18) return;
      
      setAttributes({ ...attributes, [attribute]: currentValue + 1 });
      setPointsRemaining(pointsRemaining - 1);
    } else {
      if (currentValue <= 8) return;
      
      setAttributes({ ...attributes, [attribute]: currentValue - 1 });
      setPointsRemaining(pointsRemaining + 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!characterName.trim()) {
      setError('Character name is required');
      return;
    }
    
    if (!selectedClass) {
      setError('Please select a character class');
      return;
    }
    
    try {
      setLoading(true);
      
      const characterData = {
        name: characterName,
        class: selectedClass,
        backstory,
        attributes,
        campaign_id: campaignId
      };
      
      await axios.post('/api/characters', characterData);
      
      navigate(`/campaigns/${campaignId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create character');
      setLoading(false);
    }
  };

  return (
    <div className="character-creation-page">
      <div className="page-header">
        <h1>Create a New Character</h1>
        {campaign && (
          <p className="campaign-context">
            For campaign: <strong>{campaign.name}</strong> ({campaign.theme})
          </p>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <form className="character-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h2>Basic Information</h2>
          
          <div className="form-group">
            <label htmlFor="characterName" className="form-label">Character Name</label>
            <input
              type="text"
              id="characterName"
              className="form-control"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Character Class</label>
            <div className="character-class-options">
              {characterClasses.map((charClass) => (
                <div 
                  key={charClass.name}
                  className={`class-option ${selectedClass === charClass.name ? 'selected' : ''}`}
                  onClick={() => setSelectedClass(charClass.name)}
                >
                  <h3>{charClass.name}</h3>
                  <p className="class-description">{charClass.description}</p>
                  <p className="primary-attribute">
                    Primary Attribute: <strong>{charClass.primaryAttribute.charAt(0).toUpperCase() + charClass.primaryAttribute.slice(1)}</strong>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Attributes</h2>
          <p className="points-remaining">
            Points remaining: <strong>{pointsRemaining}</strong>
          </p>
          
          <div className="attributes-grid">
            {Object.entries(attributes).map(([attr, value]) => (
              <div key={attr} className="attribute-item">
                <label className="attribute-label">
                  {attr.charAt(0).toUpperCase() + attr.slice(1)}
                </label>
                <div className="attribute-controls">
                  <button 
                    type="button" 
                    className="attribute-button decrease"
                    onClick={() => handleAttributeChange(attr, false)}
                    disabled={value <= 8}
                  >
                    -
                  </button>
                  <span className="attribute-value">{value}</span>
                  <button 
                    type="button" 
                    className="attribute-button increase"
                    onClick={() => handleAttributeChange(attr, true)}
                    disabled={value >= 18 || pointsRemaining <= 0}
                  >
                    +
                  </button>
                </div>
                {selectedClass && characterClasses.find(c => c.name === selectedClass)?.primaryAttribute === attr && (
                  <span className="primary-indicator">Primary</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h2>Backstory</h2>
          <div className="form-group">
            <label htmlFor="backstory" className="form-label">Character Backstory (Optional)</label>
            <textarea
              id="backstory"
              className="form-control"
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              rows={5}
              placeholder="Describe your character's history, motivations, and goals..."
            />
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            className="button button-outline"
            onClick={() => navigate(`/campaigns/${campaignId}`)}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="button button-primary"
            disabled={loading || !characterName.trim() || !selectedClass}
          >
            {loading ? 'Creating...' : 'Create Character'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CharacterCreationPage; 