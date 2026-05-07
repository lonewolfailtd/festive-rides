/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analyser from "../analyser.js";
import type * as analysisStore from "../analysisStore.js";
import type * as assignments from "../assignments.js";
import type * as auth from "../auth.js";
import type * as bookings from "../bookings.js";
import type * as coach from "../coach.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lookup from "../lookup.js";
import type * as openrouter from "../openrouter.js";
import type * as passwordReset from "../passwordReset.js";
import type * as references from "../references.js";
import type * as reverseLookup from "../reverseLookup.js";
import type * as sources from "../sources.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analyser: typeof analyser;
  analysisStore: typeof analysisStore;
  assignments: typeof assignments;
  auth: typeof auth;
  bookings: typeof bookings;
  coach: typeof coach;
  crons: typeof crons;
  http: typeof http;
  lookup: typeof lookup;
  openrouter: typeof openrouter;
  passwordReset: typeof passwordReset;
  references: typeof references;
  reverseLookup: typeof reverseLookup;
  sources: typeof sources;
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
