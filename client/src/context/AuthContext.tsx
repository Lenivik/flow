import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from '../lib/api'

interface User {
  id: number
  email_address: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email_address: string, password: string) => Promise<void>
  signup: (email_address: string, password: string, password_confirmation: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      api.me()
        .then((data) => setUser(data.user))
        .catch(() => {
          setToken(null)
          localStorage.removeItem('token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (email_address: string, password: string) => {
    const data = await api.login({ email_address, password })
    if (data.error) throw new Error(data.error)
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
  }

  const signup = async (email_address: string, password: string, password_confirmation: string) => {
    const data = await api.signup({ email_address, password, password_confirmation })
    if (data.errors) throw new Error(data.errors.join(', '))
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
  }

  const logout = () => {
    api.logout().catch(() => {})
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
