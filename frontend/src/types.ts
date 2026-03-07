export interface Project {
    id: number;
    name: string;
    directory: string;
    created_at: string;
    updated_at: string;
}

export interface Feature {
    id: number;
    project_id: number;
    name: string;
    created_at: string;
}

export interface DirectoryItem {
    name: string;
    path: string;
    is_dir: boolean;
}

export interface DirectoryListResponse {
    current_path: string;
    items: DirectoryItem[];
}

export interface TeamMember {
    id: number;
    team_id: number;
    name: string;
    display_name?: string;
    color?: string;
    role: string;
    prompt: string;
    acp_start_command: string;
    status: string;
}

export interface Message {
    id: number;
    feature_id: number;
    sender: string;
    content: string;
    mentions: string[];
    created_at: string;
}

export interface WorkLog {
    id: number;
    feature_id: number;
    member_id: number;
    log_type: string;
    content: string;
    created_at: string;
}

export interface StreamChunk {
    type: "stream_chunk";
    member_id: number;
    streaming_id: string;
    chunk_type: "thought" | "message" | "tool_call";
    content?: string;
    title?: string;
    tool_call_id?: string;
}

export interface StreamingBlock {
    type: "thought" | "message" | "tool_call";
    content: string;
    title?: string;
    tool_call_id?: string;
    isFinished?: boolean;
}

export interface StreamingMessage {
    member_id: number;
    streaming_id: string;
    blocks: StreamingBlock[];
}
