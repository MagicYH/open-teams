import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../api"
import type { Project } from "../types"
import CreateProjectModal from "../components/CreateProjectModal"

export default function ProjectList() {
    const [projects, setProjects] = useState<Project[]>([])
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [loading, setLoading] = useState(true)

    const loadProjects = async () => {
        setLoading(true)
        try {
            const res = await api.getProjects()
            setProjects(res)
        } catch (err) {
            console.error("Failed to load projects", err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadProjects()
    }, [])

    const handleDeleteProject = async (projectId: number, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm("Are you sure you want to delete this project?")) return

        try {
            await api.deleteProject(projectId)
            loadProjects()
        } catch (err) {
            alert("Failed to delete project")
        }
    }

    return (
        <div style={{ padding: '40px', backgroundColor: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, letterSpacing: '-1px' }}>Projects</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Manage your team projects and workspaces</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: 'var(--accent-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '15px',
                        boxShadow: '0 4px 12px rgba(0, 122, 255, 0.3)'
                    }}
                >
                    + Create Project
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>Loading projects...</div>
            ) : projects.length === 0 ? (
                <div style={{
                    padding: '80px 40px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-panel)',
                    borderRadius: '24px',
                    border: '1px dashed var(--border-color)',
                    maxWidth: '600px',
                    margin: '0 auto'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>📁</div>
                    <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>No projects yet</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Create your first project to start working with your AI team.</p>
                    <button onClick={() => setShowCreateModal(true)}>Get Started</button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
                    {projects.map(p => (
                        <div
                            key={p.id}
                            style={{
                                position: 'relative',
                                display: 'block',
                                padding: '24px',
                                backgroundColor: 'var(--bg-panel)',
                                borderRadius: '20px',
                                border: '1px solid var(--border-color)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer',
                                textDecoration: 'none'
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.borderColor = 'var(--accent-color)';
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 12px 24px -8px rgba(0,0,0,0.5)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <Link to={`/projects/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        backgroundColor: 'rgba(0, 122, 255, 0.1)',
                                        borderRadius: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '24px'
                                    }}>
                                        🏗️
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteProject(p.id, e)}
                                        style={{
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            padding: '8px',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            borderRadius: '8px'
                                        }}
                                        onMouseOver={e => e.currentTarget.style.color = '#ff453a'}
                                        onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                    </button>
                                </div>
                                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{p.name}</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <span style={{ opacity: 0.5 }}>PATH: </span>{p.directory}
                                </p>
                            </Link>
                        </div>
                    ))}
                </div>
            )}

            {showCreateModal && (
                <CreateProjectModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        setShowCreateModal(false)
                        loadProjects()
                    }}
                />
            )}
        </div>
    )
}
