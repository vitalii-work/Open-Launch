// Explicit opt-in for local development; never enabled in production builds.
export const localAuthEnabled =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_AUTH === "true"
