export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options?.headers } });
  let result;
  try { result = await response.json(); } catch { throw new ApiError('The service could not be reached. Please try again.', response.status); }
  if (!response.ok) throw new ApiError(result.message || 'Something went wrong. Please try again.', response.status);
  return result as T;
}
export const body = (data: unknown) => JSON.stringify(data);
