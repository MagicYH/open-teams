import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"

export default function NewProject() {
    const [name, setName] = useState("")
    const [directory, setDirectory] = useState("")
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name || !directory) return
        try {
            await api.createProject({ name, directory })
            navigate('/')
        } catch (err: any) {
            alert("创建失败: " + err.message)
        }
    }

    return (
        <div>
            <h1>创建项目</h1>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
                <div>
                    <label>项目名称:</label><br />
                    <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '8px' }} />
                </div>
                <div>
                    <label>项目目录:</label><br />
                    <input value={directory} onChange={e => setDirectory(e.target.value)} style={{ width: '100%', padding: '8px' }} />
                </div>
                <button type="submit" style={{ padding: '10px', cursor: 'pointer', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>提交</button>
            </form>
        </div>
    )
}
