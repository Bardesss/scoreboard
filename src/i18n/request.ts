import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale
  }
  const [common, auth, landing, app] = await Promise.all([
    import(`../../messages/${locale}/common.json`).then(m => m.default),
    import(`../../messages/${locale}/auth.json`).then(m => m.default),
    import(`../../messages/${locale}/landing.json`).then(m => m.default),
    import(`../../messages/${locale}/app.json`).then(m => m.default),
  ])
  return { locale, messages: { common, auth, landing, app } }
})
