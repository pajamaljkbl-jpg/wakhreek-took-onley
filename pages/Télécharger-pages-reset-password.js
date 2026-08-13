import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '../lib/supabase-browser'
import { useRouter } from 'next/router'

export default function ResetPassword() {
  const router = useRouter()
  const supabase = getSupabaseBrowser()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [hasSession, setHasSession] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true)
      setChecking(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasSession(true)
        setChecking(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [supabase])

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      setMessage('Mot de passe trop court (6 caractères minimum)')
      return
    }
    if (password !== confirm) {
      setMessage('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setMessage('Erreur: ' + error.message)
    } else {
      setMessage('Mot de passe changé avec succès ✅ Redirection...')
      setTimeout(() => router.push('/compte'), 1500)
    }
  }

  if (checking) {
    return <div style={{padding:60, textAlign:'center'}}>Vérification du lien...</div>
  }

  if (!hasSession) {
    return (
      <div style={{maxWidth:420, margin:'80px auto', padding:24, textAlign:'center'}}>
        <h2>Lien invalide ou expiré</h2>
        <p style={{color:'#666', marginTop:10}}>Le lien de réinitialisation a expiré. Redemande un nouveau lien depuis la page de connexion.</p>
        <button onClick={() => router.push('/login')} style={{marginTop:16, padding:12, background:'#0091ff', color:'#fff', border:'none', borderRadius:12, width:'100%'}}>Retour connexion</button>
      </div>
    )
  }

  return (
    <div style={{maxWidth:420, margin:'40px auto', padding:24}}>
      <a onClick={() => router.back()} style={{color:'#0091ff', cursor:'pointer', fontWeight:700}}>← Retour</a>
      <h1 style={{fontWeight:900, marginTop:16, fontSize:26}}>Nouveau mot de passe</h1>
      <p style={{color:'#6b7280', fontSize:13, margin:'8px 0 20px'}}>Wakh Reek — commerces et échanges de confiance.</p>

      <form onSubmit={handleUpdate}>
        <input
          type="password"
          placeholder="Nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{width:'100%', padding:14, marginBottom:12, borderRadius:12, border:'1px solid #e5e7eb'}}
          required
        />
        <input
          type="password"
          placeholder="Confirmer le mot de passe"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={{width:'100%', padding:14, marginBottom:16, borderRadius:12, border:'1px solid #e5e7eb'}}
          required
        />
        <button
          type="submit"
          disabled={loading}
          style={{width:'100%', padding:14, background:'#0091ff', color:'#fff', borderRadius:12, border:'none', fontWeight:800, cursor:'pointer'}}
        >
          {loading ? 'Changement...' : 'Changer le mot de passe'}
        </button>
      </form>
      {message && <div style={{marginTop:14, padding:12, background:'#e6f4ff', borderRadius:10, fontSize:13}}>{message}</div>}
    </div>
  )
}
