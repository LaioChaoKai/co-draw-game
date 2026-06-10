// Resolve backend Socket.io address dynamically
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

export default SOCKET_URL;
