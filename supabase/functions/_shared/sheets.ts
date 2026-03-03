/**
 * Google Sheets fetch helper using service account JWT auth.
 * Reads GOOGLE_SERVICE_ACCOUNT_JSON, GSHEET_ID, GSHEET_GID from env.
 */

// deno-lint-ignore-file no-explicit-any

function base64url(input: Uint8Array): string {
  let binary = "";
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function strToBase64url(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

async function createJwt(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const headerB64 = strToBase64url(JSON.stringify(header));
  const claimB64 = strToBase64url(JSON.stringify(claim));
  const unsignedToken = `${headerB64}.${claimB64}`;

  // Import private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${base64url(new Uint8Array(signature))}`;
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await createJwt(serviceAccount);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

/**
 * Fetch all rows from the configured Google Sheet.
 * Returns array of string arrays (rows).
 */
export async function fetchSheetRows(range = "A:AV"): Promise<string[][]> {
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");

  const sheetId = Deno.env.get("GSHEET_ID");
  if (!sheetId) throw new Error("GSHEET_ID not set");

  const serviceAccount = JSON.parse(saJson);
  const accessToken = await getAccessToken(serviceAccount);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return (data.values || []) as string[][];
}
