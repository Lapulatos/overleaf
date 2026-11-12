// Shared by task services and workspace guards so controllers preserve expected
// refusal statuses instead of treating them as unhandled server failures.
export class AgentError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}
