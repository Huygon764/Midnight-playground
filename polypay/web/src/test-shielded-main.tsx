import "./globals";
import { createRoot } from "react-dom/client";
import { setNetworkId, type NetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import "@midnight-ntwrk/dapp-connector-api";
import TestShieldedPage from "./TestShieldedPage.js";

const networkId = (import.meta.env.VITE_NETWORK_ID ?? "preprod") as NetworkId;
setNetworkId(networkId);

createRoot(document.getElementById("root")!).render(<TestShieldedPage />);
