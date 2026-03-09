import { useEffect, useRef } from "react"
import type { Message, StreamingMessage, TeamMember } from "../types"
import StreamingMessageNode from "./StreamingMessageNode"

export default function MessageList({ messages, streaming = [], members = [], onMemberClick }: { messages: Message[], streaming?: StreamingMessage[], members?: TeamMember[], onMemberClick?: (name: string) => void }) {
    const endRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, streaming])

    const getRoleColor = (senderName: string) => {
        const name = senderName.replace('@', '').toLowerCase();
        if (name === 'user') return 'var(--color-user)';
        return `var(--color-${name})`;
    }

    const handleMemberClick = (e: React.MouseEvent, name: string) => {
        e.preventDefault();
        onMemberClick?.(name);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {messages.map((m) => {
                const isMe = m.sender === '@User';
                const roleColor = getRoleColor(m.sender);
                const senderDisplay = m.sender.replace('@', '');

                return (
                    <div key={m.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        {/* Avatar */}
                        <div
                            onClick={(e) => !isMe && handleMemberClick(e, senderDisplay)}
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                backgroundColor: isMe ? '#444' : roleColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: 'white',
                                cursor: isMe ? 'default' : 'pointer'
                            }}
                        >
                            {senderDisplay.charAt(0)}
                        </div>

                        {/* Content Area */}
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{senderDisplay}</span>
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: `${roleColor}22`,
                                    color: roleColor,
                                    textTransform: 'uppercase'
                                }}>
                                    {isMe ? 'YOU' : senderDisplay}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            <div style={{
                                backgroundColor: 'var(--bubble-bg)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '0 12px 12px 12px',
                                padding: '12px 16px',
                                color: 'var(--text-primary)',
                                fontSize: '14px',
                                lineHeight: '1.6',
                                maxWidth: '90%',
                                position: 'relative'
                            }}>
                                <div style={{ whiteSpace: 'pre-wrap' }}>
                                    {m.content.split(/(@(?:[\w\-]+|Test Engineer|Product Manager|User))/gi).map((part, index) => {
                                        if (part.startsWith('@')) {
                                            const mentionName = part.replace('@', '').toLowerCase().replace(/\s+/g, '-');
                                            return <span key={index} style={{ color: `var(--color-${mentionName})`, fontWeight: 600 }}>{part}</span>
                                        }
                                        return part;
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}

            {/* Render active streaming messages */}
            {streaming.filter(sMsg => {
                const member = members.find(m => m.id === sMsg.member_id);
                // Hide the stream block in main chat IMMEDIATELY if member is idle,
                // because the finalized message in `messages` is already rendering!
                return member?.status === 'working';
            }).map((sMsg) => (
                <StreamingMessageNode
                    key={sMsg.streaming_id}
                    message={sMsg}
                    members={members}
                    onMemberClick={onMemberClick}
                    hideThoughtsAndTools={true}
                />
            ))}

            <div ref={endRef} />
        </div>
    )
}
