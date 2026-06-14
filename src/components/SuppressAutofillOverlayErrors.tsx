'use client'

import { useEffect } from 'react'

/**
 * Browser password-manager extensions (notably Bitwarden's autofill overlay,
 * `bootstrap-autofill-overlay.js`) inject an inline autofill menu into the page.
 * Their MutationObserver occasionally races React's DOM updates and throws
 * `NotFoundError: insertBefore` / `appendChild`, surfacing as an uncaught promise
 * rejection that spams the console. It's a benign third-party bug we can't fix
 * from inside the extension.
 *
 * This swallows ONLY rejections/errors whose stack originates from that extension
 * script; every other error propagates and logs normally, so real bugs are never
 * masked.
 */
export function SuppressAutofillOverlayErrors() {
  useEffect(() => {
    const isOverlayNoise = (value: unknown): boolean => {
      const err = value as { stack?: string; message?: string } | null
      const stack = err?.stack ?? ''
      const message = err?.message ?? ''
      return (
        stack.includes('bootstrap-autofill-overlay') ||
        stack.includes('autofill-inline-menu') ||
        (message.includes("insertBefore") && stack.toLowerCase().includes('autofill'))
      )
    }

    const onRejection = (e: PromiseRejectionEvent) => {
      if (isOverlayNoise(e.reason)) e.preventDefault()
    }
    const onError = (e: ErrorEvent) => {
      if (isOverlayNoise(e.error) || e.filename?.includes('bootstrap-autofill-overlay')) {
        e.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', onRejection)
    window.addEventListener('error', onError)
    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('error', onError)
    }
  }, [])

  return null
}
