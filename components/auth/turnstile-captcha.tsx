"use client"

import { useRef } from "react"

import { Turnstile } from "@marsidev/react-turnstile"

import { localAuthEnabled } from "@/lib/local-auth"

interface TurnstileCaptchaProps {
  onVerify: (token: string) => void
}

export function TurnstileCaptcha({ onVerify }: TurnstileCaptchaProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const ref = useRef(null)

  if (localAuthEnabled) return null

  if (!siteKey) {
    console.error("Turnstile site key is not defined")
    return null
  }

  return (
    <div className="flex justify-center">
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        onSuccess={onVerify}
        onError={() => console.error("Turnstile verification error")}
        onExpire={() => console.warn("Turnstile verification expired")}
        options={{
          size: "normal",
        }}
      />
    </div>
  )
}
