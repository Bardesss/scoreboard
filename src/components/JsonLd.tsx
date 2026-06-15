// Renders a Schema.org JSON-LD block. Inline <script> is permitted by the CSP
// (script-src includes 'unsafe-inline'). Pass a single node or an array of nodes.
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to inline; no user-controlled key escapes
      // the string context. </script> in content is the only risk, guarded below.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
