// En Docker el frontend y la API se sirven desde el mismo origen:
// nginx redirige /api y /health al contenedor del backend.
export const environment = {
  production: true,
  apiUrl: ''
};
