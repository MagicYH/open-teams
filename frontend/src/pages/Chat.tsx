import { useEffect, useState, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { api } from "../api"
import type { Message, TeamMember } from "../types"
import MessageList from "../components/MessageList"
import MessageInput from "../components/MessageInput"
import MemberWorkWindow from "../components/MemberWorkWindow"

export default function Chat() {
    const { featureId, projectId } = useParams()
    const [messages, setMessages] = useState<Message[]>([])
    const [members, setMembers] = useState<TeamMember[]>([])
    const [activeMember, setActiveMember] = useState<TeamMember | null>(null)
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
                width: '68px',
                backgroundColor: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '24px 0',
                gap: '24px'
            }}>
                <div style={{
                    width: '42px', height: '42px', borderRadius: '12px',
                    backgroundColor: 'var(--color-developer)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '20px', marginBottom: '12px'
                }}>
                    T
                </div>
                {['D', 'C', 'F', 'A', 'S'].map(icon => (
                    <div key={icon} style={{
                        width: '42px', height: '42px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer',
                        border: '1px solid var(--border-color)',
                        transition: 'all 0.2s'
                    }}>
                        {icon}
                    </div>
                ))}
                <div style={{ flex: 1 }}></div>
                <Link to={`/projects/${projectId}`} style={{ color: 'var(--text-muted)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </Link>
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
                        <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 700 }}>AI Core Team | Project Alpha</h2>
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
        </div>
    );
}
