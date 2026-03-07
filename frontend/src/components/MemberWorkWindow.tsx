import { useState, useEffect, useRef } from "react"
import type { TeamMember, WorkLog, StreamingMessage } from "../types"
import { api } from "../api"
import WorkLogList from "./WorkLogList"
import { StreamingBlockRenderer } from "./StreamingMessageNode"

export default function MemberWorkWindow({ member, featureId, streamingMessage }: { member: TeamMember, featureId: number, streamingMessage?: StreamingMessage }) {
    const [logs, setLogs] = useState<WorkLog[]>([])
    const endRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const fetchLogs = () => api.getWorkLogs(featureId, member.id).then(setLogs).catch(() => setLogs([]))
        fetchLogs()
        const interval = setInterval(fetchLogs, 3000)
        return () => clearInterval(interval)
    }, [featureId, member.id])

    const lastLogContent = logs[logs.length - 1]?.content || ""
    const streamingBlocksCount = streamingMessage?.blocks?.length || 0;
    const lastStreamingContent = streamingBlocksCount > 0 ? streamingMessage?.blocks[streamingBlocksCount - 1]?.content : "";

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [logs.length, lastLogContent, streamingBlocksCount, lastStreamingContent])

    const rawColor = member?.color || '#1e40af';
    const roleColor = rawColor.startsWith('var(') || rawColor.startsWith('#') || rawColor.startsWith('rgb') ? rawColor : `var(--color-${member.name.toLowerCase()})`;


    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        backgroundColor: `var(--color-${member.name.toLowerCase()})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 'bold', fontSize: '13px'
                    }}>
                        {member.name.charAt(0)}
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{member.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{member.role}</div>
                    </div>
                </div>
                {member.status === 'working' ? (
                    <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', animation: 'pulse 1.5s infinite' }}></div>
                        WORKING
                    </div>
                ) : (
                    <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                        IDLE
                    </div>
                )}
            </div>

            <div style={{ padding: '12px', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                {member.prompt}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {logs.length === 0 && !streamingMessage?.blocks?.length ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                        Waiting for agent activity...
                    </div>
                ) : (
                    <>
                        <WorkLogList logs={logs} />
                        {streamingMessage?.blocks?.map((block, idx) => (
                            <StreamingBlockRenderer
                                key={idx}
                                block={block}
                                isLast={idx === streamingMessage.blocks.length - 1}
                                roleColor={roleColor}
                            />
                        ))}
                    </>
                )}
                <div ref={endRef} />
            </div>
        </div>
    )
}
