import { useState, useEffect } from 'react';
import { api } from '../api';
import type { DirectoryItem } from '../types';

interface DirectoryPickerProps {
    initialPath?: string;
    onSelect: (path: string) => void;
}

export default function DirectoryPicker({ initialPath = '~', onSelect }: DirectoryPickerProps) {
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [inputPath, setInputPath] = useState(initialPath);
    const [items, setItems] = useState<DirectoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newDirName, setNewDirName] = useState('');
    const [showNewDirInput, setShowNewDirInput] = useState(false);

    const loadDirectories = async (path: string, isInitialLoad = false) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.listDirectories(path);
            setCurrentPath(res.current_path);
            setInputPath(res.current_path);
            setItems(res.items);
            onSelect(res.current_path);
        } catch (err: any) {
            const errMsg = err.message || 'Failed to load directories';
            if (isInitialLoad && path !== '/home') {
                console.warn(`Initial path ${path} failed, falling back to /home. Error: ${errMsg}`);
                return loadDirectories('/home', true);
            } else {
                setError(errMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDirectories(initialPath, true);
    }, []);

    const handleItemClick = (item: DirectoryItem) => {
        if (item.is_dir) {
            loadDirectories(item.path);
        }
    };

    const handleCreateDir = async () => {
        if (!newDirName) return;
        try {
            await api.createDirectory(currentPath, newDirName);
            setNewDirName('');
            setShowNewDirInput(false);
            loadDirectories(currentPath);
        } catch (err: any) {
            setError(err.message || 'Failed to create directory');
        }
    };

    return (
        <div style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginTop: '8px'
        }}>
            <div style={{
                padding: '8px 12px',
                backgroundColor: 'var(--bg-panel)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <span style={{ fontWeight: 600 }}>Path:</span>
                <input
                    value={inputPath}
                    onChange={e => setInputPath(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            loadDirectories(inputPath);
                        }
                    }}
                    style={{
                        flex: 1,
                        padding: '4px 8px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        outline: 'none'
                    }}
                    placeholder="Enter directory path..."
                />
                <button
                    type="button"
                    onClick={() => loadDirectories(inputPath)}
                    style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        backgroundColor: 'var(--bg-button)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Go
                </button>
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                {loading && <div style={{ padding: '8px', fontSize: '12px' }}>Loading...</div>}
                {error && <div style={{ padding: '8px', fontSize: '12px', color: '#ff453a' }}>{error}</div>}
                {!loading && items.map((item, idx) => (
                    <div
                        key={idx}
                        onClick={() => handleItemClick(item)}
                        style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '14px',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-panel)'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <span>{item.name === '..' ? '📁' : '📂'}</span>
                        <span style={{ flex: 1 }}>{item.name}</span>
                    </div>
                ))}
            </div>

            <div style={{ padding: '8px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
                {showNewDirInput ? (
                    <>
                        <input
                            value={newDirName}
                            onChange={e => setNewDirName(e.target.value)}
                            placeholder="New folder name"
                            style={{
                                flex: 1,
                                padding: '4px 8px',
                                backgroundColor: 'var(--bg-main)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                color: 'var(--text-primary)',
                                fontSize: '12px'
                            }}
                            autoFocus
                        />
                        <button type="button" onClick={handleCreateDir} style={{ padding: '4px 8px', fontSize: '12px' }}>Create</button>
                        <button type="button" onClick={() => setShowNewDirInput(false)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: 'transparent', border: '1px solid var(--border-color)' }}>Cancel</button>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowNewDirInput(true)}
                        style={{
                            width: '100%',
                            padding: '6px',
                            fontSize: '12px',
                            backgroundColor: 'transparent',
                            border: '1px dashed var(--border-color)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        + New Directory
                    </button>
                )}
            </div>
        </div>
    );
}
