import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Trash2, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

interface Project {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export default function ProjectsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    api.getProjects().then(setProjects)
  }, [])

  const createProject = async () => {
    if (!newName.trim()) return
    const project = await api.createProject(newName.trim())
    setProjects((prev) => [project, ...prev])
    setNewName('')
    setShowNew(false)
  }

  const deleteProject = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    await api.deleteProject(String(id))
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Flow</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-400">{user?.email_address}</span>
          <button className="p-2 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-neutral-800" title="Settings">
            <Settings size={18} />
          </button>
          <button onClick={logout} className="p-2 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-neutral-800" title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold text-white">Projects</h2>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New project
          </button>
        </div>

        {showNew && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-6 flex gap-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createProject()}
              placeholder="Project name"
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <button onClick={createProject} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">Create</button>
            <button onClick={() => { setShowNew(false); setNewName('') }} className="text-neutral-400 hover:text-white px-3 py-2 text-sm transition-colors">Cancel</button>
          </div>
        )}

        {projects.length === 0 && !showNew ? (
          <div className="text-center py-20">
            <FolderOpen size={48} className="mx-auto text-neutral-700 mb-4" />
            <p className="text-neutral-500">No projects yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group bg-neutral-900 border border-neutral-800 rounded-xl p-5 cursor-pointer hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-white font-medium truncate pr-2">{project.name}</h3>
                  <button
                    onClick={(e) => deleteProject(project.id, e)}
                    className="p-1 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  Updated {new Date(project.updated_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
