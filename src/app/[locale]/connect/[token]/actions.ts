'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const COOKIE_NAME = 'pendingConnect'
const TTL_SECONDS = 60 * 60 * 24 // 1 day

export async function startConnectLogin(token: string, locale: string) {
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TTL_SECONDS,
    path: '/',
  })
  redirect(`/${locale}/auth/login`)
}

export async function startConnectRegister(token: string, locale: string) {
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TTL_SECONDS,
    path: '/',
  })
  redirect(`/${locale}/auth/register`)
}
