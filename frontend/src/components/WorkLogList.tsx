import type { WorkLog } from "../types"
import { StreamingBlockRenderer } from "./StreamingMessageNode"
export default function WorkLogList({ logs }: { logs: WorkLog[] }) {
    if (logs.length === 0) return null

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {logs.map((log, idx) => {
                const isOutput = log.log_type === 'output' || log.log_type === 'message';

                if (!isOutput) {
                    let blockContent = log.content;
                    let blockTitle = log.log_type === 'tool_call' ? 'Tool Call Result' : 'Thought Process';

                    if (log.log_type === 'tool_call') {
                        try {
                            const parsed = JSON.parse(log.content);
                            blockTitle = parsed.tool_name || 'Tool';

                            let constructedContent = `Tool Call: ${blockTitle} (${log.id})`;
                            if (parsed.arguments) {
                                constructedContent += `\nArguments:\n${JSON.stringify(parsed.arguments, null, 2)}`;
                            }
                            if (parsed.result) {
                                const resultStr = typeof parsed.result === 'object'
                                    ? JSON.stringify(parsed.result, null, 2)
                                    : String(parsed.result);
                                constructedContent += `\n\nTool Call Result (${log.id}):\n${resultStr}`;
                            }
                            blockContent = constructedContent;
                        } catch (e) {
                            // Fallback to plain text if not valid JSON
                        }
                    }

                    const block = {
                        type: log.log_type,
                        content: blockContent,
                        title: blockTitle,
                        tool_call_id: log.id.toString()
                    };
                    return (
                        <StreamingBlockRenderer
                            key={log.id}
                            block={block}
                            isLast={idx === logs.length - 1}
                            roleColor="var(--text-muted)"
                        />
                    );
                }

                return (
                    <div key={log.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: isOutput ? '#34c759' : '#f59e0b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            Final Message
                        </div>

                        <div style={{
                            padding: '12px',
                            borderRadius: '8px',
                            backgroundColor: '#1e1e1e',
                            border: '1px solid rgba(255,255,255,0.05)',
                            color: 'var(--text-secondary)',
                            fontSize: '13px',
                            fontFamily: 'monospace',
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
