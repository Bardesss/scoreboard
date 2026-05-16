import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import AdminSidebar from '@/components/layout/AdminSidebar'
import AdminMobileHeader from '@/components/layout/AdminMobileHeader'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  if (session.user.role !== 'admin') redirect('/en')

  return (
    <div style={{ minHeight: '100vh', background: '#0c0f10' }}>
      <AdminSidebar />
      <AdminMobileHeader />
      <main
        className="lg:ml-60 pt-14 lg:pt-0 px-4 lg:px-8 py-6 lg:py-8"
        style={{
          minHeight: '100vh',
        }}
      >
        {children}
      </main>
    </div>
  )
}
