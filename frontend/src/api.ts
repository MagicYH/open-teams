import type { Project, Feature, TeamMember, Message, WorkLog, DirectoryListResponse } from "./types";



class ApiClient {
    private requestLog: Array<{ url: string; method: string; log_id: string; timestamp: number }> = [];

    private async request<T>(url: string, options?: RequestInit): Promise<T & { log_id: string }> {
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options?.headers,
            },
        });
        const log_id = response.headers.get("X-LogID") || "unknown";
        let data;
        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.detail || "API request failed");
        }

        this.requestLog.push({
            url,
            method: options?.method || "GET",
            log_id,
            timestamp: Date.now(),
        });

        console.log(`[API] ${options?.method || "GET"} ${url}`, { log_id });

        if (Array.isArray(data)) {
            (data as any).log_id = log_id;
            return data as any;
        }
        return { ...data, log_id };
    }

    getRequestLog() {
        return this.requestLog;
    }

    getProjects() {
        return this.request<Project[]>("/api/projects");
    }

    createProject(data: { name: string; directory: string }) {
        return this.request<Project>("/api/projects", {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    deleteProject(projectId: number) {
        return this.request<{ status: string }>("/api/projects/" + projectId, {
            method: "DELETE",
        });
    }

    getFeatures(projectId: number) {
        return this.request<Feature[]>(`/api/projects/${projectId}/features`);
    }

    createFeature(projectId: number, data: { name: string }) {
        return this.request<Feature>(`/api/projects/${projectId}/features`, {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    deleteFeature(projectId: number, featureId: number) {
        return this.request<{ status: string }>(`/api/projects/${projectId}/features/${featureId}`, {
            method: "DELETE",
        });
    }

    getTeam(projectId: number) {
        return this.request<{ id: number, project_id: number, members: TeamMember[] }>(`/api/projects/${projectId}/team`);
    }

    getMessages(featureId: number) {
        return this.request<Message[]>(`/api/features/${featureId}/messages`);
    }

    createMessage(featureId: number, data: { feature_id: number, sender: string, content: string, mentions: string[] }) {
        return this.request<Message>(`/api/features/${featureId}/messages`, {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    getWorkLogs(featureId: number, memberId: number) {
        return this.request<WorkLog[]>(`/api/features/${featureId}/members/${memberId}/logs`);
    }

    listDirectories(path: string = "/") {
        return this.request<DirectoryListResponse>(`/api/utils/list-directories?path=${encodeURIComponent(path)}`);
    }

    createDirectory(path: string, name: string) {
        return this.request<{ status: string, path: string }>("/api/utils/create-directory", {
            method: "POST",
            body: JSON.stringify({ path, name }),
        });
    }
}

export const api = new ApiClient();
