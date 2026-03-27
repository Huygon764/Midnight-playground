import "./globals";

import React from "react";
import ReactDOM from "react-dom/client";
import { setNetworkId, type NetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import App from "./App";
import "@midnight-ntwrk/dapp-connector-api";

const networkId = (import.meta.env.VITE_NETWORK_ID ?? "preprod") as NetworkId;
setNetworkId(networkId);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
