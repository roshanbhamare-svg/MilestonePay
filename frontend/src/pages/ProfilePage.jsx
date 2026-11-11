import { useState } from 'react';
import { Save, Plus, X, UserCircle } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { formatDate, getErrorMessage, getInitials } from '../utils/formatters';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.profile?.bio || '');
  const [avatar, setAvatar] = useState(user?.profile?.avatar || '');
  const [skills, setSkills] = useState(user?.profile?.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addSkill = () => {
    const clean = skillInput.trim();
    if (!clean) return;
    if (!skills.includes(clean)) {
      setSkills((prev) => [...prev, clean]);
    }
    setSkillInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        skills,
        avatar: avatar.trim(),
      });
      toast.success('Profile updated successfully!');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-col gap-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile Settings</h1>
          <p className="page-subtitle">Manage your personal details, bio, and skill tags.</p>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="grid grid-cols-3">
        <Card>
          <div className="flex-col items-center" style={{ textAlign: 'center', padding: '12px 0' }}>
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '999px',
                  objectFit: 'cover',
                  border: '2px solid var(--brand)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '999px',
                  background: 'var(--brand-soft)',
                  color: '#93c5fd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 700,
                }}
              >
                {getInitials(name || user?.name)}
              </div>
            )}
            <h2 style={{ margin: '14px 0 4px', fontSize: '18px' }}>{user?.name}</h2>
            <div className="text-sm text-muted mb-3">{user?.email}</div>
            <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
              <UserCircle size={12} /> {user?.role}
            </span>
            <div className="text-sm text-dim mt-4">
              Member since {formatDate(user?.createdAt)}
            </div>
          </div>
        </Card>

        <div style={{ gridColumn: 'span 2' }}>
          <Card title="Edit Profile Information">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-name">
                  Full Name *
                </label>
                <input
                  id="prof-name"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="prof-avatar">
                  Avatar URL
                </label>
                <input
                  id="prof-avatar"
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/avatar.png"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="prof-bio">
                  Bio
                </label>
                <textarea
                  id="prof-bio"
                  className="form-textarea"
                  maxLength={500}
                  placeholder="Describe your background, experience, or project focus..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
                <span className="form-hint">{bio.length} / 500 characters</span>
              </div>

              <div className="form-group">
                <label className="form-label">Skills & Specialties</label>
                <div className="flex gap-2 mb-2">
                  <input
                    className="form-input"
                    placeholder="Add a skill (e.g., React, Node.js, LangGraph)"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                  />
                  <Button variant="secondary" icon={Plus} onClick={addSkill}>
                    Add
                  </Button>
                </div>

                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span key={skill} className="badge badge-info">
                        {skill}
                        <button
                          type="button"
                          onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                          }}
                          aria-label={`Remove ${skill}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" variant="primary" icon={Save} loading={saving}>
                Save Profile Changes
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

