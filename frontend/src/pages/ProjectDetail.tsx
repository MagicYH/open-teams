import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { api } from "../api"
import type { Feature, TeamMember, Project } from "../types"

// ─── Modal for Add / Edit Team Member ────────────────────────────────────────

interface MemberForm {
    name: string
    acp_start_command: string
    role: string
    prompt: string
}

const EMPTY_FORM: MemberForm = { name: "", acp_start_command: "", role: "", prompt: "" }

interface MemberModalProps {
    projectId: number
    member: TeamMember | null   // null = create mode
    onClose: () => void
    onSaved: () => void
}

function MemberModal({ projectId, member, onClose, onSaved }: MemberModalProps) {
    const [form, setForm] = useState<MemberForm>(
        member
            ? { name: member.name, acp_start_command: member.acp_start_command, role: member.role, prompt: member.prompt }
            : EMPTY_FORM
    )
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name.trim() || !form.role.trim()) {
            setError("Name and Role are required.")
            return
        }
        setSaving(true)
        setError("")
        try {
            if (member) {
                await api.updateMember(projectId, member.id, form)
            } else {
                await api.createMember(projectId, form)
            }
            onSaved()
            onClose()
        } catch (err: any) {
            setError(err.message || "Failed to save member.")
        } finally {
            setSaving(false)
        }
    }

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "10px 12px",
        backgroundColor: "var(--bg-main)",
        border: "1px solid var(--border-color)",
        borderRadius: "8px",
        color: "var(--text-primary)",
        fontSize: "14px",
        outline: "none",
        boxSizing: "border-box",
        fontFamily: "inherit",
    }

    const labelStyle: React.CSSProperties = {
        fontSize: "12px",
        color: "var(--text-muted)",
        marginBottom: "6px",
        display: "block",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
    }

    return (
        <div
            style={{
                position: "fixed", inset: 0,
                backgroundColor: "rgba(0,0,0,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 1000,
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div style={{
                backgroundColor: "var(--bg-panel)",
                border: "1px solid var(--border-color)",
                borderRadius: "16px",
                padding: "32px",
                width: "520px",
                maxWidth: "90vw",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                    <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
                        {member ? "Edit Team Member" : "Add Team Member"}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px", lineHeight: 1 }}
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div>
                        <label style={labelStyle}>Name</label>
                        <input
                            style={inputStyle}
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Alice"
                            disabled={saving}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Start Command</label>
                        <input
                            style={inputStyle}
                            value={form.acp_start_command}
                            onChange={e => setForm(f => ({ ...f, acp_start_command: e.target.value }))}
                            placeholder="e.g. acp-openai-agent"
                            disabled={saving}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Role</label>
                        <input
                            style={inputStyle}
                            value={form.role}
                            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                            placeholder="e.g. Backend Engineer"
                            disabled={saving}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>System Prompt</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: "120px", resize: "vertical", lineHeight: "1.5" }}
                            value={form.prompt}
                            onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                            placeholder="Describe the agent's behavior and responsibilities..."
                            disabled={saving}
                        />
                    </div>

                    {error && (
                        <div style={{ color: "#ff453a", fontSize: "13px", backgroundColor: "rgba(255,69,58,0.1)", padding: "10px 14px", borderRadius: "8px" }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            style={{
                                padding: "10px 20px",
                                backgroundColor: "transparent",
                                border: "1px solid var(--border-color)",
                                borderRadius: "8px",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: "14px",
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !form.name.trim()}
                            style={{
                                padding: "10px 24px",
                                backgroundColor: "var(--accent-color)",
                                border: "none",
                                borderRadius: "8px",
                                color: "white",
                                cursor: saving || !form.name.trim() ? "not-allowed" : "pointer",
                                fontWeight: 600,
                                fontSize: "14px",
                                opacity: saving || !form.name.trim() ? 0.7 : 1,
                            }}
                        >
                            {saving ? "Saving…" : member ? "Save Changes" : "Add Member"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetail() {
    const { projectId } = useParams()
    const [features, setFeatures] = useState<Feature[]>([])
    const [members, setMembers] = useState<TeamMember[]>([])
    const [project, setProject] = useState<Project | null>(null)
    const [newFeatureName, setNewFeatureName] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [statusColor, setStatusColor] = useState("transparent")

    // Modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null)

    const loadData = async () => {
        if (!projectId) return
        const id = parseInt(projectId)
        const [feats, teamData, projs] = await Promise.all([
            api.getFeatures(id),
            api.getTeam(id),
            api.getProjects()
        ])
        setFeatures(feats)
        setMembers(teamData.members || [])
        const p = projs.find(proj => proj.id === id)
        if (p) setProject(p)
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

    const handleDeleteMember = async (memberId: number) => {
        if (!projectId) return
        if (!confirm("Delete this team member?")) return
        await api.deleteMember(parseInt(projectId), memberId)
        await loadData()
    }

    const openAddModal = () => {
        setEditingMember(null)
        setModalOpen(true)
    }

    const openEditModal = (m: TeamMember) => {
        setEditingMember(m)
        setModalOpen(true)
    }

    return (
        <div style={{ padding: '40px', backgroundColor: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>{project ? project.name : `Project detail #${projectId}`}</h1>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '18px', margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Team Members</h2>
                        <button
                            onClick={openAddModal}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                backgroundColor: 'var(--accent-color)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Member
                        </button>
                    </div>

                    {members.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '14px' }}>
                            No members assigned.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {members.map(m => (
                                <div key={m.id} style={{
                                    padding: '16px',
                                    backgroundColor: 'var(--bg-panel)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '12px',
                                        backgroundColor: `var(--color-${m.name.toLowerCase()})`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 800, fontSize: '18px',
                                        flexShrink: 0,
                                    }}>
                                        {m.name.charAt(0)}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.role}</div>
                                    </div>

                                    {/* Status dot */}
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34c759', flexShrink: 0 }}></div>

                                    {/* Edit button */}
                                    <button
                                        onClick={() => openEditModal(m)}
                                        title="Edit member"
                                        style={{
                                            background: 'none', border: 'none', padding: '4px',
                                            color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '4px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                        onMouseOver={e => e.currentTarget.style.color = 'var(--accent-color)'}
                                        onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>

                                    {/* Delete button */}
                                    <button
                                        onClick={() => handleDeleteMember(m.id)}
                                        title="Delete member"
                                        style={{
                                            background: 'none', border: 'none', padding: '4px',
                                            color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '4px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                        onMouseOver={e => e.currentTarget.style.color = '#ff453a'}
                                        onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add / Edit Modal */}
            {modalOpen && projectId && (
                <MemberModal
                    projectId={parseInt(projectId)}
                    member={editingMember}
                    onClose={() => setModalOpen(false)}
                    onSaved={loadData}
                />
            )}
        </div>
    )
}
