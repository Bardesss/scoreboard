import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import AdminSidebar from '@/components/layout/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  if (session.user.role !== 'admin') redirect('/en')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0c0f10' }}>
      <AdminSidebar />
      <main
        style={{
          flex: 1,
          marginLeft: 240,
          padding: '32px',
          overflowY: 'auto',
          minHeight: '100vh',
        }}
      >
        {children}
      </main>
    </div>
  )
}
