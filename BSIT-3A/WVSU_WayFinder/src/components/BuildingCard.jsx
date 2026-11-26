import React, { useState } from 'react';

const BuildingCard = ({ building, onClose }) => {
  const [imgError, setImgError] = useState(false);

  // If no building is selected, render nothing
  if (!building) return null;

  return (
    <div className="building-card-overlay">
      <div className="building-card">
        <button onClick={onClose} className="close-btn" aria-label="Close card">
          &times;
        </button>
        
        <div className="image-container">
          {!imgError && building.photo ? (
            <img 
              src={building.photo} 
              alt={building.name} 
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px 8px 0 0' }}
            />
          ) : (
            <div className="placeholder-fallback" style={fallbackStyle}>
              <span style={{ fontSize: '36px' }}>🏢</span>
              <p style={{ margin: '8px 0 0 0', fontWeight: '500', color: '#64748B' }}>
                Front-view photo coming soon
              </p>
            </div>
          )}
        </div>

        <div className="card-details" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 4px 0', color: '#0B2545', fontSize: '18px' }}>
            {building.name}
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: imgError ? '#D97706' : '#059669' }}>
            {imgError ? '⚠️ Pending Photo Upload' : '✅ Photo Linked'}
          </p>
        </div>
      </div>
    </div>
  );
};

const fallbackStyle = {
  width: '100%',
  height: '200px',
  backgroundColor: '#F1F5F9',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '8px 8px 0 0',
  borderBottom: '1px solid #E2E8F0'
};

export default BuildingCard;