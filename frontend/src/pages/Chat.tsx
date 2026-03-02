import { useEffect, useState, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { api } from "../api"
import type { Message, TeamMember, Project, Feature } from "../types"
import MessageList from "../components/MessageList"
import MessageInput from "../components/MessageInput"
import MemberWorkWindow from "../components/MemberWorkWindow"

export default function Chat() {
    const { featureId, projectId } = useParams()
    const [messages, setMessages] = useState<Message[]>([])
    const [members, setMembers] = useState<TeamMember[]>([])
    const [activeMember, setActiveMember] = useState<TeamMember | null>(null)
    const [project, setProject] = useState<Project | null>(null)
    const [feature, setFeature] = useState<Feature | null>(null)
    const ws = useRef<WebSocket | null>(null)

    useEffect(() => {
        if (!featureId || !projectId) return
        const id = parseInt(featureId)
        const pid = parseInt(projectId)

        api.getMessages(id).then(setMessages)
        api.getTeam(pid).then(res => {
            const teamMembers = res.members || []
            setMembers(teamMembers)
            if (teamMembers.length > 0 && !activeMember) {
                setActiveMember(teamMembers[0])
            }
        })
        api.getProjects().then(projects => {
            const p = projects.find(proj => proj.id === pid)
            if (p) setProject(p)
        })
        api.getFeatures(pid).then(features => {
            const f = features.find(feat => feat.id === id)
            if (f) setFeature(f)
        })

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${protocol}//${window.location.host}/ws/chat/${id}`)
        socket.onmessage = (event) => {
            const newMsg = JSON.parse(event.data)
            setMessages(prev => [...prev, newMsg])
        }
        ws.current = socket

        return () => {
            socket.close()
        }
    }, [featureId, projectId])

    const handleSend = async (content: string, mentions: string[]) => {
        if (!featureId) return
        const msg = {
            feature_id: parseInt(featureId),
            sender: "@User",
            content,
            mentions
        }
        await api.createMessage(parseInt(featureId), msg)
    }

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--bg-main)' }}>
            {/* 1. Left Sidebar (Navigation) */}
            <div style={{
                width: '240px',
                backgroundColor: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                padding: '24px',
                gap: '24px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {project?.name || 'Loading Project...'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={project?.directory || `/ projects / ${projectId}`}>
                                {project?.directory || `/ projects / ${projectId}`}
                            </span>
                        </div>
                    </div>
                    <Link to={`/projects/${projectId}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-muted)',
                        textDecoration: 'none',
                        fontSize: '12px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer',
                        backgroundColor: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        flexShrink: 0
                    }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-panel)'}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                        </svg>
                        <span>Back</span>
                    </Link>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>Team Status</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {members.map(m => (
                            <div
                                key={m.id}
                                onClick={() => setActiveMember(m)}
                                style={{
                                    padding: '12px',
                                    borderRadius: '8px',
                                    backgroundColor: activeMember?.id === m.id ? 'rgba(0, 122, 255, 0.1)' : 'var(--bg-panel)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    border: activeMember?.id === m.id ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: m.color || '#333' }}></div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{m.name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{activeMember?.id === m.id ? 'Active' : 'Idle'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>


            </div>

            {/* 2. Main Chat Column */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}>
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 700 }}>{feature?.name || 'Feature'} | {project?.name || 'Loading...'}</h2>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', padding: '4px' }}>🔍</button>
                            <button style={{ backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}>+ New Message</button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <span>Mentions: You,</span>
                        {members.map(m => (
                            <span key={m.id} style={{ color: `var(--color-${m.name.toLowerCase()})`, fontWeight: 500 }}>
                                @{m.name}
                            </span>
                        ))}
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    <MessageList
                        messages={messages}
                        onMemberClick={(name) => {
                            const member = members.find(m => m.name.toLowerCase() === name.toLowerCase())
                            if (member) setActiveMember(member)
                        }}
                    />
                </div>

                {/* Input Area */}
                <div style={{ padding: '0 24px 24px 24px' }}>
                    <MessageInput onSend={handleSend} members={members} />
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                        Active Status: Agent Online
                    </div>
                </div>
            </div>

            {/* 3. Work Window Sidebar */}
            <div style={{
                width: '380px',
                backgroundColor: 'var(--bg-main)',
                borderLeft: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Work Window</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#1e40af', color: 'white', fontSize: '10px', fontWeight: 600 }}>THINKING</div>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {/* Active Agent Context */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>Current Output</div>
                        <div style={{ borderRadius: '12px', backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '16px' }}>
                            {activeMember ? (
                                <MemberWorkWindow member={activeMember} featureId={parseInt(featureId!)} />
                            ) : (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No active agents</div>
                            )}
                        </div>
                    </div>


                </div>
            </div>
        </div>
    );
}
