import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import axios from 'axios';

interface Campaign {
  id: number;
  name: string;
  description: string;
  theme: string;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
}

const DashboardPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    theme: 'medieval-fantasy'
  });

  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await axios.get('/api/campaigns');
        setCampaigns(res.data);
        setLoading(false);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load campaigns');
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setNewCampaign({
      ...newCampaign,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const res = await axios.post('/api/campaigns', newCampaign);
      
      setCampaigns([...campaigns, res.data]);
      setNewCampaign({
        name: '',
        description: '',
        theme: 'medieval-fantasy'
      });
      setShowNewCampaignForm(false);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create campaign');
      setLoading(false);
    }
  };

  if (loading && campaigns.length === 0) {
    return <div className="loading">Loading campaigns...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Welcome, {user?.username || 'Adventurer'}!</h1>
        <button 
          className="button button-primary"
          onClick={() => setShowNewCampaignForm(!showNewCampaignForm)}
        >
          {showNewCampaignForm ? 'Cancel' : 'Start New Campaign'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {showNewCampaignForm && (
        <div className="new-campaign-form">
          <h2>Start a New Campaign</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name" className="form-label">Campaign Name</label>
              <input
                type="text"
                id="name"
                name="name"
                className="form-control"
                value={newCampaign.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="theme" className="form-label">Theme</label>
              <select
                id="theme"
                name="theme"
                className="form-control"
                value={newCampaign.theme}
                onChange={handleInputChange}
                required
              >
                <option value="medieval-fantasy">Medieval Fantasy</option>
                <option value="sci-fi">Science Fiction</option>
                <option value="post-apocalyptic">Post-Apocalyptic</option>
                <option value="cyberpunk">Cyberpunk</option>
                <option value="steampunk">Steampunk</option>
                <option value="horror">Horror</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">Description</label>
              <textarea
                id="description"
                name="description"
                className="form-control"
                value={newCampaign.description}
                onChange={handleInputChange}
                rows={3}
                required
              />
            </div>

            <button type="submit" className="button button-primary">
              Create Campaign
            </button>
          </form>
        </div>
      )}

      <div className="campaigns-section">
        <h2>Your Campaigns</h2>
        
        {campaigns.length === 0 ? (
          <p>You don't have any campaigns yet. Start a new one to begin your adventure!</p>
        ) : (
          <div className="campaign-list">
            {campaigns.map(campaign => (
              <div key={campaign.id} className="campaign-card">
                <h3>{campaign.name}</h3>
                <p className="campaign-theme">Theme: {campaign.theme}</p>
                <p className="campaign-description">{campaign.description}</p>
                <div className="campaign-footer">
                  <span className={`campaign-status status-${campaign.status}`}>
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </span>
                  <Link to={`/campaigns/${campaign.id}`} className="button">
                    Enter Campaign
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage; 