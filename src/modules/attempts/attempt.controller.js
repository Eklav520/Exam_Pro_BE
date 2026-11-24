import * as attemptService from "./attempt.service.js";

export async function get(request, response) {
  response.json(await attemptService.get(request.params.id, request.user._id));
}

export async function saveAnswers(request, response) {
  const { params, user, validated } = request;
  response.json(await attemptService.saveAnswers(params.id, user._id, validated.body));
}

export async function submit(request, response) {
  const { params, user, validated } = request;
  response.json(await attemptService.submit(params.id, user._id, validated.body));
}

export async function listResults(request, response) {
  response.json(await attemptService.listResults(request.user._id));
}

export async function getResult(request, response) {
  response.json(await attemptService.getResult(request.params.id, request.user._id));
}
