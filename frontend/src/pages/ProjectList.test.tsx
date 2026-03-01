import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi, describe, it, expect } from 'vitest'
import ProjectList from './ProjectList'
import { api } from '../api'

vi.mock('../api', () => ({
    api: {
        getProjects: vi.fn()
    }
}))

describe('ProjectList Component', () => {
    it('renders "暂无项目" when projects list is empty', async () => {
        (api.getProjects as any).mockResolvedValueOnce([])
        render(<BrowserRouter><ProjectList /></BrowserRouter>)
        expect(screen.getByText('项目列表')).toBeInTheDocument()
        await waitFor(() => {
            expect(screen.getByText('暂无项目，请先创建一个。')).toBeInTheDocument()
        })
    })

    it('renders a list of projects when available', async () => {
        const mockProjects = [
            { id: 1, name: 'Project A', directory: '/path/a', created_at: '2023-01-01', updated_at: '2023-01-01' },
            { id: 2, name: 'Project B', directory: '/path/b', created_at: '2023-01-02', updated_at: '2023-01-02' }
        ];
        (api.getProjects as any).mockResolvedValueOnce(mockProjects)
        render(<BrowserRouter><ProjectList /></BrowserRouter>)
        await waitFor(() => {
            expect(screen.getByText('Project A')).toBeInTheDocument()
            expect(screen.getByText('目录: /path/a')).toBeInTheDocument()
            expect(screen.getByText('Project B')).toBeInTheDocument()
        })
    })
})
