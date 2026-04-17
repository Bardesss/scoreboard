import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: string
      locale: string
      totpEnabled: boolean
      requiresMfa: boolean
    }
  }
}
