import "./globals";
import { createRoot } from "react-dom/client";
import { setNetworkId, type NetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import "@midnight-ntwrk/dapp-connector-api";
import TestShieldedPage from "./TestShieldedPage.js";

// Debug: intercept fetch to log /prove and /check request/response details
const origFetch = window.fetch.bind(window);
window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const isProofCall = url.includes("/prove") || url.includes("/check");
  const isKeyFetch = url.includes("/keys/") || url.includes("/zkir/");
  if (isProofCall) {
    const body = init?.body;
    const bodySize =
      body instanceof Uint8Array ? body.byteLength :
      body instanceof ArrayBuffer ? body.byteLength :
      typeof body === "string" ? body.length : "?";
    console.log(`[fetch debug] ${init?.method ?? "GET"} ${url} bodySize=${bodySize}`);
  }
  if (isKeyFetch) {
    console.log(`[fetch debug] ${init?.method ?? "GET"} ${url}`);
  }
  const response = await origFetch(input as any, init);
  if ((isProofCall || isKeyFetch) && !response.ok) {
    const clone = response.clone();
    let bodyText = "<unreadable>";
    try { bodyText = await clone.text(); } catch {}
    console.error(`[fetch debug] FAIL ${response.status} ${response.statusText} url=${url}\n  body: ${bodyText}`);
  } else if (isProofCall && response.ok) {
    console.log(`[fetch debug] OK ${response.status} url=${url}`);
  }
  return response;
};

const networkId = (import.meta.env.VITE_NETWORK_ID ?? "preprod") as NetworkId;
setNetworkId(networkId);

createRoot(document.getElementById("root")!).render(<TestShieldedPage />);
