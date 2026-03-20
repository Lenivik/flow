import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SignupPage() {
  const { signup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await signup(email, password, passwordConfirmation)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950">
      <div className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold text-white mb-8 text-center">Create an account</h1>
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">Confirm password</label>
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            Create account
          </button>
        </form>
        <p className="text-center text-sm text-neutral-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
