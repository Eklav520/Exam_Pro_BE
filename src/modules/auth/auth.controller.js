import * as authService from "./auth.service.js";

export async function login(request, response) {
  response.json(await authService.login(request.validated.body));
}

export function me(request, response) {
  const { id, name, email, role } = request.user;
  response.json({ id, name, email, role });
}
