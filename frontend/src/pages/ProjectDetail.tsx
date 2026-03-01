import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { api } from "../api"
import type { Feature, TeamMember } from "../types"

export default function ProjectDetail() {
    const { projectId } = useParams()
    const [features, setFeatures] = useState<Feature[]>([])
    const [members, setMembers] = useState<TeamMember[]>([])
    const [newFeatureName, setNewFeatureName] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [statusColor, setStatusColor] = useState("transparent")

    const loadData = async () => {
        if (!projectId) return
        const id = parseInt(projectId)
        const [feats, teamData] = await Promise.all([
            api.getFeatures(id),
            api.getTeam(id)
        ])
        setFeatures(feats)
        setMembers(teamData.members || [])
    }

    useEffect(() => {
        loadData()
    }, [projectId])

    const handleAddFeature = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newFeatureName || !projectId || isCreating) return

        setIsCreating(true)
        try {
            await api.createFeature(parseInt(projectId), { name: newFeatureName })
            setNewFeatureName("")
            setStatusColor("#34c759")
            setTimeout(() => setStatusColor("transparent"), 3000)
            await loadData()
        } catch (err) {
            alert("Failed to create feature")
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div style={{ padding: '40px', backgroundColor: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>Project detail #{projectId}</h1>
                <Link to="/" style={{
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Back to Projects
                </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '40px' }}>
                {/* Features Column */}
                <div>
                    <h2 style={{ fontSize: '18px', marginBottom: '20px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Features</h2>

                    <form onSubmit={handleAddFeature} style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <input
                                value={newFeatureName}
                                onChange={e => setNewFeatureName(e.target.value)}
                                placeholder="Add a new feature..."
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: 'var(--bg-panel)',
                                    border: `1px solid ${statusColor === "transparent" ? "var(--border-color)" : statusColor}`,
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    transition: 'border-color 0.3s'
                                }}
                                disabled={isCreating}
                            />
                            {statusColor !== "transparent" && (
                                <div style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: statusColor,
                                    fontSize: '12px',
                                    fontWeight: 600
                                }}>
                                    Success!
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={isCreating || !newFeatureName}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: 'var(--accent-color)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: isCreating ? 'not-allowed' : 'pointer',
                                opacity: isCreating || !newFeatureName ? 0.7 : 1
                            }}
                        >
                            {isCreating ? 'Adding...' : 'Add Feature'}
                        </button>
                    </form>

                    {features.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                            No features defined for this project.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {features.map(f => (
                                <Link
                                    key={f.id}
                                    to={`/projects/${projectId}/features/${f.id}/chat`}
                                    style={{
                                        display: 'block',
                                        textDecoration: 'none',
                                        padding: '20px',
                                        backgroundColor: 'var(--bg-panel)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <button
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (!confirm("Delete this feature?")) return;
                                                    await api.deleteFeature(parseInt(projectId!), f.id);
                                                    loadData();
                                                }}
                                                style={{
                                                    backgroundColor: 'transparent',
                                                    border: 'none',
                                                    padding: '4px',
                                                    color: 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    borderRadius: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onMouseOver={e => e.currentTarget.style.color = '#ff453a'}
                                                onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                            <div style={{ color: 'var(--text-muted)' }}>&rarr;</div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Team Column */}
                <div>
                    <h2 style={{ fontSize: '18px', marginBottom: '20px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Team Members</h2>
                    {members.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '14px' }}>
                            No members assigned.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {members.map(m => (
                                <div key={m.id} style={{
                                    padding: '16px',
                                    backgroundColor: 'var(--bg-panel)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px'
                                }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '12px',
                                        backgroundColor: `var(--color-${m.name.toLowerCase()})`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 800, fontSize: '18px'
                                    }}>
                                        {m.name.charAt(0)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.role}</div>
                                    </div>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34c759' }}></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
