import { Plan } from "../plan";
import { Terms } from "../types";
import { UniQuery } from "./query";

export interface SendUniResponse {
    hiddenReentrance?: Uint8Array;  // If present, further searches are possible
    plans: Plan[];  // Found paths
}

/**
 * Sends a Uni lift request to the peer identified by the link
 * @param link The link identifier of the peer to send the request to
 * @param plan The path nonces (SessionCode anonymized links) of all parent edges encountered so far, and other terms
 * @param query Original query from originator
 * @param hiddenReentrance The encrypted reentrance data returned by the peer from prior request (if not first request)
 */
export type SendUniFunc = (link: string, plan: Plan, query: UniQuery, hiddenReentrance?: Uint8Array) => Promise<SendUniResponse>;

/**
 * A function that compares the terms on a link with the query terms and returns the terms as constained by the match or undefined if there is no match
 * @param linkTerms The terms on the link
 * @param queryTerms The terms in the query
 * @returns The terms that match, or undefined if there is no match
 */
export type MatchTermsFunc = (linkTerms: Terms, queryTerms: Terms) => Terms | undefined;
