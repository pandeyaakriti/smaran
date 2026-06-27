import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import "leaflet/dist/leaflet.css";
import "./styles/index.css";

import App from "./App.jsx";
import store from "./store";   // adjust path if needed

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
);