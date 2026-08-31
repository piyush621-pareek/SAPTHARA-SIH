import ReactDOM from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import App from "./App";
import LoginGate from "./components/LoginGate";

// NOTE: StrictMode is intentionally omitted. Its dev-only double-invoke of
// effects double-initializes the MapLibre map (creating then tearing down the
// GL context mid-style-load), which corrupts the raster source.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <LoginGate>
    <App />
  </LoginGate>
);
