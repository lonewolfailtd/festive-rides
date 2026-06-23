/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _ical from "../_ical.js";
import type * as aiChecker from "../aiChecker.js";
import type * as analyser from "../analyser.js";
import type * as analysisStore from "../analysisStore.js";
import type * as apaReview from "../apaReview.js";
import type * as articleQA from "../articleQA.js";
import type * as assignmentArtifacts from "../assignmentArtifacts.js";
import type * as assignmentChat from "../assignmentChat.js";
import type * as assignmentChatHistory from "../assignmentChatHistory.js";
import type * as assignments from "../assignments.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as bibliographyImport from "../bibliographyImport.js";
import type * as bookings from "../bookings.js";
import type * as checkerHistory from "../checkerHistory.js";
import type * as citations from "../citations.js";
import type * as coach from "../coach.js";
import type * as courses from "../courses.js";
import type * as crons from "../crons.js";
import type * as dataExport from "../dataExport.js";
import type * as feedbackMemory from "../feedbackMemory.js";
import type * as http from "../http.js";
import type * as icalSubscription from "../icalSubscription.js";
import type * as lookup from "../lookup.js";
import type * as nzEditor from "../nzEditor.js";
import type * as openrouter from "../openrouter.js";
import type * as passwordReset from "../passwordReset.js";
import type * as plagiarism from "../plagiarism.js";
import type * as questionUnpacker from "../questionUnpacker.js";
import type * as quickImport from "../quickImport.js";
import type * as references from "../references.js";
import type * as researchQuestion from "../researchQuestion.js";
import type * as reverseLookup from "../reverseLookup.js";
import type * as sourceLens from "../sourceLens.js";
import type * as sources from "../sources.js";
import type * as submissionAudit from "../submissionAudit.js";
import type * as toolChat from "../toolChat.js";
import type * as usage from "../usage.js";
import type * as userSettings from "../userSettings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  _ical: typeof _ical;
  aiChecker: typeof aiChecker;
  analyser: typeof analyser;
  analysisStore: typeof analysisStore;
  apaReview: typeof apaReview;
  articleQA: typeof articleQA;
  assignmentArtifacts: typeof assignmentArtifacts;
  assignmentChat: typeof assignmentChat;
  assignmentChatHistory: typeof assignmentChatHistory;
  assignments: typeof assignments;
  auditLog: typeof auditLog;
  auth: typeof auth;
  bibliographyImport: typeof bibliographyImport;
  bookings: typeof bookings;
  checkerHistory: typeof checkerHistory;
  citations: typeof citations;
  coach: typeof coach;
  courses: typeof courses;
  crons: typeof crons;
  dataExport: typeof dataExport;
  feedbackMemory: typeof feedbackMemory;
  http: typeof http;
  icalSubscription: typeof icalSubscription;
  lookup: typeof lookup;
  nzEditor: typeof nzEditor;
  openrouter: typeof openrouter;
  passwordReset: typeof passwordReset;
  plagiarism: typeof plagiarism;
  questionUnpacker: typeof questionUnpacker;
  quickImport: typeof quickImport;
  references: typeof references;
  researchQuestion: typeof researchQuestion;
  reverseLookup: typeof reverseLookup;
  sourceLens: typeof sourceLens;
  sources: typeof sources;
  submissionAudit: typeof submissionAudit;
  toolChat: typeof toolChat;
  usage: typeof usage;
  userSettings: typeof userSettings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
