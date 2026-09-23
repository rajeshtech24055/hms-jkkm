import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function MenuPage() {
  const { api, user } = useAuth();
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackStats, setFeedbackStats] = useState(null);

  useEffect(() => {
    fetchMenu();
    fetchFeedbackStats();
  }, [api]);

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const data = await api('/api/menu');
      setMenu(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbackStats = async () => {
    try {
      const data = await api('/api/mess/feedback/stats');
      setFeedbackStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const avgRating = feedbackStats?.average_rating?.toFixed(1) || 'N/A';
  const ratingCount = feedbackStats?.total_feedback || 0;

  const isFoodAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'FOOD_ADMIN';
  const [editDay, setEditDay] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleEditClick = (dayMenu, day) => {
    setEditDay(day);
    setEditForm({
      breakfast: dayMenu.breakfast || '',
      lunch: dayMenu.lunch || '',
      snacks: dayMenu.snacks || '',
      dinner: dayMenu.dinner || ''
    });
  };

  const handleSave = async (day) => {
    try {
      await api(`/api/menu/${day}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      setEditDay(null);
      fetchMenu();
    } catch (err) {
      alert('Failed to update menu: ' + err.message);
    }
  };

  return (
    <div className="page-enter">
      <div className="section-header">
        <h2>🥗 Weekly Mess Menu</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid var(--primary)', padding: '6px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-light)' }}>{avgRating}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⭐ ({ratingCount})</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={fetchMenu}>🔄 Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          DAYS.map(day => {
            const dayMenu = menu.find(m => m.day === day) || {};
            const isEditing = editDay === day;

            return (
              <div key={day} className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{day}</h3>
                  {isFoodAdmin && !isEditing && (
                    <button className="btn btn-sm btn-outline" onClick={() => handleEditClick(dayMenu, day)}>
                      ✏️ Edit
                    </button>
                  )}
                  {isFoodAdmin && isEditing && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditDay(null)}>Cancel</button>
                      <button className="btn btn-sm btn-primary" onClick={() => handleSave(day)}>Save</button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  {['breakfast', 'lunch', 'snacks', 'dinner'].map(meal => (
                    <div key={meal} style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 6 }}>
                        {meal} {meal === 'breakfast' ? '(7:30 - 9:00 AM)' : meal === 'lunch' ? '(12:30 - 2:00 PM)' : meal === 'snacks' ? '(4:30 - 5:30 PM)' : '(7:30 - 9:00 PM)'}
                      </div>
                      {isEditing ? (
                        <textarea
                          className="form-input"
                          style={{ minHeight: 60, fontSize: 13 }}
                          value={editForm[meal]}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [meal]: e.target.value }))}
                        />
                      ) : (
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{dayMenu[meal] || 'Not specified'}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mess Feedback Section - Only visible to Students */}
      {user?.role === 'STUDENT' && (
        <>
          <div className="section-header" style={{ marginTop: 32 }}>
            <h3>🌟 Rate Today's Meal</h3>
          </div>
          <div className="card" style={{ padding: '24px' }}>
            <FeedbackForm onFeedbackSubmitted={fetchFeedbackStats} />
          </div>
        </>
      )}
    </div>
  );
}

function FeedbackForm({ onFeedbackSubmitted }) {
  const { api, user } = useAuth();
  const [rating, setRating] = useState(0);
  const [mealType, setMealType] = useState('Breakfast');
  const [dishName, setDishName] = useState('');
  const [comment, setComment] = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating || !dishName) return alert('Please provide rating and dish name');
    try {
      await api('/api/mess/feedback', {
        method: 'POST',
        body: JSON.stringify({
          student_id: user?.id,
          rating,
          meal_type: mealType,
          dish_name: dishName,
          comment,
          date: new Date().toISOString().split('T')[0]
        })
      });
      alert('Feedback submitted!');
      setRating(0);
      setDishName('');
      setComment('');
    } catch (err) {
      alert('Error submitting feedback: ' + err.message);
    }
  };
  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      <div className="form-group">
        <label className="form-label">Meal Type</label>
        <select className="form-input" value={mealType} onChange={e => setMealType(e.target.value)}>
          <option>Breakfast</option>
          <option>Lunch</option>
          <option>Dinner</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Dish Name</label>
        <input className="form-input" value={dishName} onChange={e => setDishName(e.target.value)} required />
      </div>
      <div className="form-group">
        <label className="form-label">Rating</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1,2,3,4,5].map(num => (
            <span key={num} style={{ cursor: 'pointer', fontSize: 24, color: rating >= num ? '#f5c518' : '#ccc' }} onClick={() => setRating(num)}>{'★'}</span>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Comment (optional)</label>
        <textarea className="form-input" value={comment} onChange={e => setComment(e.target.value)} rows={2}></textarea>
      </div>
      <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>Submit Feedback</button>
    </form>
  );
}

