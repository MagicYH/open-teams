import { useState, useEffect } from "react";
import type { StreamingMessage, TeamMember } from "../types";

export default function StreamingMessageNode({ message, members, onMemberClick, hideThoughtsAndTools = false }: { message: StreamingMessage, members: TeamMember[], onMemberClick?: (name: string) => void, hideThoughtsAndTools?: boolean }) {
    const member = members.find(m => m.id === message.member_id);
    const senderDisplay = member?.name || "Agent";
    // Check if member color is a valid CSS variable or a static hex/rgb color
    const rawColor = member?.color || '#1e40af';
    const roleColor = rawColor.startsWith('var(') || rawColor.startsWith('#') || rawColor.startsWith('rgb') ? rawColor : `var(--color-${senderDisplay.toLowerCase()})`;

    const handleMemberClick = (e: React.MouseEvent, name: string) => {
        e.preventDefault();
        onMemberClick?.(name);
    }

    const visibleBlocks = hideThoughtsAndTools ? message.blocks.filter(b => b.type === 'message') : message.blocks;
    if (visibleBlocks.length === 0) return null;

    return (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', opacity: 0.95 }}>
            {/* Avatar */}
            <div
                onClick={(e) => handleMemberClick(e, senderDisplay)}
                style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    backgroundColor: roleColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: '14px', fontWeight: 'bold', color: 'white',
                    cursor: 'pointer'
                }}
            >
                {senderDisplay.charAt(0)}
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{senderDisplay}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${roleColor}`, color: roleColor, textTransform: 'uppercase' }}>
                        {senderDisplay}
                    </span>
                    <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'pulse 1.5s infinite' }}></div>
                        Typing...
                    </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '90%' }}>
                    {visibleBlocks.map((block, idx) => (
                        <StreamingBlockRenderer
                            key={idx}
                            block={block}
                            isLast={idx === visibleBlocks.length - 1}
                            roleColor={roleColor}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

export function StreamingBlockRenderer({ block, isLast, roleColor }: { block: any, isLast: boolean, roleColor: string }) {
    const [expanded, setExpanded] = useState(isLast && block.type !== 'tool_call');

    // Auto collapse non-last blocks for thinking/tool_calls after a short delay
    useEffect(() => {
        if (block.type === 'tool_call') {
            setExpanded(false);
        } else if (!isLast && block.type === 'thought') {
            setExpanded(false);
        } else if (isLast) {
            setExpanded(true);
        }
    }, [isLast, block.type]);

    if (block.type === 'message') {
        return (
            <div style={{
                backgroundColor: 'var(--bubble-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '0 12px 12px 12px',
                padding: '12px 16px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                lineHeight: '1.6',
                position: 'relative',
                whiteSpace: 'pre-wrap',
                minHeight: '24px' // Ensure block doesn't collapse entirely when empty
            }}>
                {block.content.split(/(@\w+)/g).map((part: string, index: number) => {
                    if (part.startsWith('@')) {
                        const mentionName = part.replace('@', '').toLowerCase();
                        return <span key={index} style={{ color: `var(--color-${mentionName})`, fontWeight: 600 }}>{part}</span>
                    }
                    return part;
                })}
                {isLast && <span style={{ marginLeft: '2px', borderRight: `2px solid var(--text-primary)`, display: 'inline-block', height: '14px', animation: 'blink 1s step-end infinite' }}>&nbsp;</span>}
            </div>
        )
    }

    if (block.type === 'thought' || block.type === 'tool_call') {
        const title = block.type === 'thought' ? 'Thinking Process' : `Tool Call: ${block.title || 'Unknown Tool'}`;
        const iconColor = block.type === 'thought' ? '#8b5cf6' : '#f59e0b';

        return (
            <div style={{
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                overflow: 'hidden',
                fontSize: '13px'
            }}>
                <div
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderBottom: expanded ? '1px solid var(--border-color)' : 'none'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: iconColor }}>
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
                    </div>
                    {isLast && <div style={{ fontSize: '10px', color: roleColor, animation: 'pulse 1.5s infinite' }}>running...</div>}
                </div>
                {expanded && (
                    <div style={{
                        padding: '12px',
                        color: 'var(--text-muted)',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                        fontSize: '12px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        backgroundColor: 'rgba(0,0,0,0.2)'
                    }}>
                        {block.content}
                        {isLast && <span style={{ marginLeft: '2px', borderRight: `2px solid var(--text-muted)`, display: 'inline-block', height: '12px', animation: 'blink 1s step-end infinite' }}>&nbsp;</span>}
                    </div>
                )}
            </div>
        )
    }

    return null;
}
