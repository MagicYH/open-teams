import { useState, useRef, useEffect } from "react"
import type { TeamMember } from "../types"

export default function MessageInput({ onSend, members }: { onSend: (content: string, mentions: string[]) => void, members: TeamMember[] }) {
    const [content, setContent] = useState("")
    const [mentionSearch, setMentionSearch] = useState<string | null>(null)
    const [mentionIndex, setMentionIndex] = useState(0)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px'
        }
    }, [content])

    const filteredMembers = mentionSearch !== null
        ? members.filter(m => m.name.toLowerCase().includes(mentionSearch.toLowerCase()))
        : []

    const parseMentions = (text: string) => {
        // Support standard roles, hyphenated roles, and specific spaced roles mapped in yaml settings
        const matches = text.match(/@(?:[\w\-]+|Test Engineer|Product Manager|User)/gi)
        return matches ? Array.from(new Set(matches.map(m => m.substring(1)))) : []
    }

    const handleSend = () => {
        if (!content.trim()) return
        const mentions = parseMentions(content)
        onSend(content, mentions)
        setContent("")
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
        }
    }

    const insertMention = (memberName: string) => {
        if (mentionSearch === null || !textareaRef.current) return

        const cursorSettings = textareaRef.current.selectionStart
        const textBeforeAt = content.lastIndexOf('@', cursorSettings - 1)
        const textAfterMention = content.substring(cursorSettings)

        const newContent = content.substring(0, textBeforeAt) + `@${memberName} ` + textAfterMention
        setContent(newContent)
        setMentionSearch(null)

        // Focus back to textarea
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus()
                const newPos = textBeforeAt + memberName.length + 2
                textareaRef.current.setSelectionRange(newPos, newPos)
            }
        }, 0)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (mentionSearch !== null) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setMentionIndex(prev => (prev + 1) % filteredMembers.length)
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length)
                return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                if (filteredMembers[mentionIndex]) {
                    insertMention(filteredMembers[mentionIndex].name)
                } else {
                    setMentionSearch(null)
                }
                return
            }
            if (e.key === 'Escape') {
                setMentionSearch(null)
                return
            }
        }

        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value
        setContent(val)

        const cursor = e.target.selectionStart
        const lastAt = val.lastIndexOf('@', cursor - 1)

        if (lastAt !== -1) {
            const textAfterAt = val.substring(lastAt + 1, cursor)
            if (!textAfterAt.includes(' ')) {
                setMentionSearch(textAfterAt)
                setMentionIndex(0)
                return
            }
        }
        setMentionSearch(null)
    }

    return (
        <div style={{ position: 'relative' }}>
            {mentionSearch !== null && filteredMembers.length > 0 && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '8px',
                    backgroundColor: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                    zIndex: 100,
                    width: '200px',
                    overflow: 'hidden'
                }}>
                    {filteredMembers.map((m, idx) => (
                        <div
                            key={m.id}
                            onClick={() => insertMention(m.name)}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                backgroundColor: idx === mentionIndex ? 'var(--accent-color)' : 'transparent',
                                color: idx === mentionIndex ? 'white' : 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: m.color || '#333' }}></div>
                            {m.name}
                        </div>
                    ))}
                </div>
            )}

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-panel)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                padding: '12px 16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={handleChange}
                        placeholder="Type a message... (Ctrl + Enter to send, @ to mention)"
                        style={{
                            flex: 1,
                            padding: '8px 0',
                            border: 'none',
                            resize: 'none',
                            outline: 'none',
                            backgroundColor: 'transparent',
                            color: 'var(--text-primary)',
                            fontFamily: 'inherit',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            minHeight: '21px',
                            maxHeight: '120px'
                        }}
                        rows={1}
                        onKeyDown={handleKeyDown}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={handleSend}
                            disabled={!content.trim()}
                            style={{
                                padding: '7px 16px',
                                backgroundColor: content.trim() ? 'var(--accent-color)' : 'var(--text-muted)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: content.trim() ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                marginBottom: '4px',
                                fontWeight: 600,
                                fontSize: '13px'
                            }}
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
