import type { WorkLog } from "../types"

export default function WorkLogList({ logs }: { logs: WorkLog[] }) {
    if (logs.length === 0) return null

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {logs.map(log => {
                const isOutput = log.log_type === 'output' || log.log_type === 'tool_call';

                return (
                    <div key={log.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: log.log_type === 'thought' ? '#f59e0b' : '#34c759',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {log.log_type === 'thought' ? 'Thought Process' : 'Drafting Output'}
                        </div>

                        <div style={{
                            padding: isOutput ? '12px' : '4px 0',
                            borderRadius: '8px',
                            backgroundColor: isOutput ? '#1e1e1e' : 'transparent',
                            border: isOutput ? '1px solid rgba(255,255,255,0.05)' : 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '13px',
                            fontFamily: isOutput ? 'monospace' : 'inherit',
                            lineHeight: '1.5',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {log.content}
                        </div>
                    </div>
                );
            })}
        </div>
    )
}
