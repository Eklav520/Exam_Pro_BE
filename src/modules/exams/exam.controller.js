import * as attemptService from "../attempts/attempt.service.js";
import * as examService from "./exam.service.js";

export async function list(request, response) {
  response.json(await examService.listForStudent(request.user._id));
}

export async function get(request, response) {
  response.json(await examService.getForStudent(request.params.id, request.user._id));
}

export async function startAttempt(request, response) {
  response.json(await attemptService.start(request.params.id, request.user._id));
}

export async function adminList(_request, response) {
  response.json(await examService.listForAdmin());
}

export async function adminGet(request, response) {
  response.json(await examService.getForAdmin(request.params.id));
}

export async function adminCreate(request, response) {
  response.status(201).json(await examService.create(request.validated.body));
}

export async function adminUpdate(request, response) {
  response.json(await examService.update(request.params.id, request.validated.body));
}

export async function adminRemove(request, response) {
  await examService.remove(request.params.id);
  response.status(204).end();
}
