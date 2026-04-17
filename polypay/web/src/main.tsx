import "./globals";
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { setNetworkId, type NetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import App from "./App";
import { ToastProvider, ConfirmProvider } from "./components/ui";
import "@midnight-ntwrk/dapp-connector-api";

const networkId = (import.meta.env.VITE_NETWORK_ID ?? "preprod") as NetworkId;
setNetworkId(networkId);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfirmProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ConfirmProvider>
  </React.StrictMode>,
);
