import { BrowserRouter, Routes, Route } from "react-router-dom"
import ProjectList from "./pages/ProjectList"
import NewProject from "./pages/NewProject"
import ProjectDetail from "./pages/ProjectDetail"
import Chat from "./pages/Chat"

function App() {
  return (
    <BrowserRouter>
      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/projects/new" element={<NewProject />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/projects/:projectId/features/:featureId/chat" element={<Chat />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
