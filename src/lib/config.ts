import { getLocaleHeader } from "@lib/util/get-locale-header"
import Medusa from "@medusajs/medusa-js"

// Defaults to standard port for Medusa server
let MEDUSA_BACKEND_URL = "http://localhost:9000"

if (process.env.MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL

  if (
    !MEDUSA_BACKEND_URL.startsWith("http://") &&
    !MEDUSA_BACKEND_URL.startsWith("https://")
  ) {
    MEDUSA_BACKEND_URL = `https://${MEDUSA_BACKEND_URL}`
  }
}

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  maxRetries: 3,
})

const client = sdk.client as any

client.fetch = async <T>(
  input: string,
  init: {
    method?: string
    query?: Record<string, unknown>
    headers?: Record<string, string>
    body?: unknown
    next?: unknown
    cache?: unknown
  } = {}
): Promise<T> => {
  const { method = "GET", query, headers = {}, body } = init

  const mergedHeaders: Record<string, string> = {
    ...headers,
  }

  try {
    const localeHeader = await getLocaleHeader()
    if (
      localeHeader?.["x-medusa-locale"] &&
      !mergedHeaders["x-medusa-locale"]
    ) {
      mergedHeaders["x-medusa-locale"] = localeHeader["x-medusa-locale"]
    }
  } catch (_error) {
    // Silently fail if locale header retrieval fails
  }

  let path = input

  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue
      }
      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, String(item)))
      } else {
        params.append(key, String(value))
      }
    }
    path = `${path}${path.includes("?") ? "&" : "?"}${params.toString()}`
  }

  const payload = body ?? undefined

  return client.request(method, path, payload, undefined, mergedHeaders)
}

// ─────────────────────────────────────────────
// STORE ADAPTER — Medusa V1 → V2 compatible
// ─────────────────────────────────────────────
const store = {
  cart: {
    create: (
      payload?: Record<string, unknown>,
      _opts?: unknown,
      headers?: Record<string, string>
    ) => sdk.carts.create(payload as any, headers),

    update: (
      cartId: string,
      payload: Record<string, unknown>,
      _opts?: unknown,
      headers?: Record<string, string>
    ) => sdk.carts.update(cartId, payload as any, headers),

    createLineItem: (
      cartId: string,
      payload: Record<string, unknown>,
      _opts?: unknown,
      headers?: Record<string, string>
    ) => sdk.carts.lineItems.create(cartId, payload as any, headers),

    updateLineItem: (
      cartId: string,
      lineId: string,
      payload: Record<string, unknown>,
      _opts?: unknown,
      headers?: Record<string, string>
    ) => sdk.carts.lineItems.update(cartId, lineId, payload as any, headers),

    deleteLineItem: (
      cartId: string,
      lineId: string,
      _opts?: unknown,
      headers?: Record<string, string>
    ) => sdk.carts.lineItems.delete(cartId, lineId, headers),

    addShippingMethod: (
      cartId: string,
      payload: Record<string, unknown>,
      _opts?: unknown,
      headers?: Record<string, string>
    ) => sdk.carts.addShippingMethod(cartId, payload as any, headers),

    complete: (
      cartId: string,
      _opts?: unknown,
      headers?: Record<string, string>
    ) => sdk.carts.complete(cartId, headers),

    transferCart: async (
      cartId: string,
      _payload?: Record<string, unknown>,
      _opts?: unknown,
      headers?: Record<string, string>
    ) => {
      return sdk.carts.update(cartId, {} as any, headers)
    },
  },

  customer: {
    create: (
      payload: Record<string, unknown>,
      _opts?: unknown,
      headers?: Record<string, string>
    ) => sdk.customers.create(payload as any, headers),

    update: (
      payload: Record<string, unknown>,
      _opts?: unknown,
      headers?: Record<string, string>
    ) => sdk.customers.update(payload as any, headers),

    createAddress: (
      payload: Record<string, unknown>,
      _opts?: unknown,
      headers?: Record<string, string>
    ) =>
      sdk.customers.addresses.addAddress(
        { address: payload } as any,
        headers
      ),

    deleteAddress: (
      addressId: string,
      headers?: Record<string, string>
    ) => sdk.customers.addresses.deleteAddress(addressId, headers),

    updateAddress: (
      addressId: string,
      payload: Record<string, unknown>,
      _opts?: unknown,
      headers?: Record<string, string>
    ) =>
      sdk.customers.addresses.updateAddress(
        addressId,
        payload as any,
        headers
      ),
  },
  order: {
    requestTransfer: async (
      _id: string,
      _payload?: Record<string, unknown>,
      _opts?: unknown,
      _headers?: Record<string, string>
    ): Promise<{ order: null }> => {
      return { order: null }
    },

    acceptTransfer: async (
      _id: string,
      _payload?: Record<string, unknown>,
      _opts?: unknown,
      _headers?: Record<string, string>
    ): Promise<{ order: null }> => {
      return { order: null }
    },

    declineTransfer: async (): Promise<never> => {
      throw new Error(
        "Order transfer decline is not supported in Medusa v1 compatibility mode"
      )
    },
  },

  payment: {
    initiatePaymentSession: async (
      cart: any,
      data: { provider_id: string },
      _opts?: unknown,
      headers?: Record<string, string>
    ) =>
      sdk.carts.setPaymentSession(
        cart.id,
        { provider_id: data.provider_id } as any,
        headers
      ),
  },
}

// ─────────────────────────────────────────────
// INYECCIÓN DE STORE EN SDK
// ─────────────────────────────────────────────
;(sdk as any).store = store

// ─────────────────────────────────────────────
// AUTH ADAPTER — Medusa V1 → V2 compatible
// ─────────────────────────────────────────────

// ✅ Register
;(sdk as any).auth.register = async (
  type: string,
  method: string,
  payload: any
) => {
  if (type !== "customer" || method !== "emailpass") {
    throw new Error(
      "Only customer/emailpass registration is supported in Medusa v1 compatibility mode"
    )
  }

  await sdk.customers.create(payload as any)

  const { access_token } = await (sdk.auth as any).authenticate({
    email: payload.email,
    password: payload.password,
  })

  return access_token
}

// ✅ Login
;(sdk as any).auth.login = async (
  type: string,
  method: string,
  payload: any
) => {
  if (type !== "customer" || method !== "emailpass") {
    throw new Error(
      "Only customer/emailpass login is supported in Medusa v1 compatibility mode"
    )
  }

  const { access_token } = await (sdk.auth as any).authenticate({
    email: payload.email,
    password: payload.password,
  })

  return access_token
}

// ✅ Logout — V1 deleteSession no acepta parámetros
;(sdk as any).auth.logout = async () => sdk.auth.deleteSession()