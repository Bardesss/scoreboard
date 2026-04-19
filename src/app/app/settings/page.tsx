import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-2 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.2)' }}>
        <Settings size={28} style={{ color: '#f5a623' }} />
      </div>
      <h1 className="font-headline font-black text-2xl mb-2" style={{ color: '#1c1810' }}>Instellingen</h1>
      <p className="font-body text-sm" style={{ color: '#9a8878' }}>Binnenkort beschikbaar — beheer hier je accountinstellingen.</p>
    </div>
  )
}
