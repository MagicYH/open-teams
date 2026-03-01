import { useState } from 'react';
import { api } from '../api';
import DirectoryPicker from './DirectoryPicker';

interface CreateProjectModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateProjectModal({ onClose, onSuccess }: CreateProjectModalProps) {
    const [name, setName] = useState('');
    const [directory, setDirectory] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !directory) return;

        setLoading(true);
        setError(null);
        try {
            await api.createProject({ name, directory });
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to create project');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: 'var(--bg-panel)',
                width: '100%',
                maxWidth: '500px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                padding: '32px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Create New Project</h2>
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: 'transparent',
                            padding: '8px',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '20px'
                        }}
                    >
                        &times;
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>Project Name</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. My Awesome Project"
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                backgroundColor: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>Project Directory</label>
                        <DirectoryPicker onSelect={setDirectory} />
                        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            Selected: <span style={{ color: 'var(--text-secondary)' }}>{directory}</span>
                        </div>
                    </div>

                    {error && (
                        <div style={{ marginBottom: '16px', color: '#ff453a', fontSize: '14px' }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                flex: 1,
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name || !directory}
                            style={{
                                flex: 1,
                                opacity: loading || !name || !directory ? 0.6 : 1
                            }}
                        >
                            {loading ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
