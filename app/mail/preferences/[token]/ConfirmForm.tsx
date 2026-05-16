'use client'

import { useActionState } from 'react'
import { confirmUnsubscribe } from './actions'
import type { ConfirmResult } from './actions'

interface Props {
  rawToken: string
  orgName: string
  recipientEmail: string
  buttonColor: string
  buttonTextColor: string
  textColor: string
}

export default function ConfirmForm({
  rawToken,
  orgName,
  recipientEmail,
  buttonColor,
  buttonTextColor,
  textColor,
}: Props) {
  const [state, formAction, isPending] = useActionState<ConfirmResult | null, FormData>(
    confirmUnsubscribe,
    null,
  )

  if (state?.ok) {
    return (
      <>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: textColor,
            marginBottom: 12,
            lineHeight: 1.3,
          }}
        >
          You have been unsubscribed.
        </h1>
        <p style={{ fontSize: 14, color: textColor, lineHeight: 1.65, margin: 0 }}>
          Your request has been processed. You will no longer receive campaign emails from{' '}
          {orgName}.
        </p>
      </>
    )
  }

  return (
    <>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: textColor,
          marginBottom: 12,
          lineHeight: 1.3,
        }}
      >
        Confirm unsubscribe
      </h1>
      <p style={{ fontSize: 14, color: textColor, lineHeight: 1.65, marginBottom: 8 }}>
        You&rsquo;re unsubscribing from campaign emails from{' '}
        <strong style={{ color: textColor }}>{orgName}</strong> at{' '}
        <strong style={{ color: textColor }}>{recipientEmail}</strong>.
      </p>
      <p style={{ fontSize: 13, color: textColor, lineHeight: 1.6, marginBottom: 24 }}>
        You may still receive essential administrative or personal messages when appropriate.
      </p>
      <form action={formAction}>
        <input type="hidden" name="token" value={rawToken} />
        <button
          type="submit"
          disabled={isPending}
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            background: isPending ? '#9ca3af' : buttonColor,
            color: buttonTextColor,
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {isPending ? 'Processing…' : 'Yes, unsubscribe me'}
        </button>
      </form>
      {state && !state.ok && (
        <p style={{ fontSize: 13, color: '#dc2626', marginTop: 16, marginBottom: 0 }}>
          {state.error}
        </p>
      )}
    </>
  )
}
