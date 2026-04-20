export function useApi<T>(path: string, options: Parameters<typeof $fetch<T>>[1] = {}) {
  const config = useRuntimeConfig();
  const baseURL = import.meta.server ? config.apiBaseInternal : config.public.apiBase;

  return $fetch<T>(path, {
    baseURL,
    ...options,
  });
}
