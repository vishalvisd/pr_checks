export const GHE_EVENT_TYPES = {
  PULL_REQUEST: "pull_request",
  CHECK_SUITE: "check_suite",
  CHECK_RUN: "check_run"
};

export const GHE_EVENT_PAYLOAD_ACTION = {
  PR_OPENED: "opened",
  PR_REOPENED: "reopened",
  PR_UPDATED: "synchronize",
  CHECK_CREATED: "created",
  CHECK_REQUESTED: "requested",
  CHECK_REREQUESTED: "rerequested",
  PULL_REQUEST_EDITED: "edited"
};

export const CHECK_CONCLUSION_TYPES = {
  ACTION_REQUIRED: "action_required",
  CANCELLED: "cancelled",
  FAILURE: "failure",
  NEUTRAL: "neutral",
  SUCCESS: "success",
  SKIPPED: "skipped",
  STALE: "stale",
  TIMED_OUT: "timed_out"
};
