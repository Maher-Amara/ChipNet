import { LinearOptions } from "./linear-options";
import crypto from 'crypto';
import { LinearRequest } from "./linear-request";
import { LinearResponse } from "./linear-response";
import { LinearQuery } from "./linear-query";
import { LinearRoute } from "./linear-route";
import { ILinearState } from "./linear-state";
import { generateQueryId, nonceFromAddress } from "./query-id";

/**
 * Simple implementation of linear state based on in-memory structures
 */
export class MemoryLinearState implements ILinearState {
    private _responses: Record<string, LinearResponse> = {};
    private _outstanding: Record<string, LinearRequest> = {};
    private _failures: Record<string, string> = {};  // TODO: structured error information
    private _query: LinearQuery;
    private _noncesByAddress: Record<string, string>;

    get query() { return this._query; }

    constructor(
        public options: LinearOptions
    ) {
        const queryId = generateQueryId(this.options.queryOptions);
        this._query = { target: this.options.target, queryId };
        this._noncesByAddress = this.options.peerAddresses.reduce((c, address) => {
                c[address] = nonceFromAddress(address, queryId);;
                return c;
            }, {} as Record<string, string>
        );
    }

    getRoutes() {
        return Object.entries(this._responses)
            .flatMap(([address, response]) => response.paths.map(p => new LinearRoute(address, response.depth, p)))
    }

    /**
     * @returns The currently failed requests.  Do not mutate
     */
    getFailures() {
        return this._failures;
    }

    addFailure(address: string, error: string) {
        this._failures[address] = error;
        delete this._outstanding[address];
    }

    getResponse(address: string): LinearResponse | undefined {
        return this._responses[address];
    }

    addResponse(address: string, response: LinearResponse) {
        this._responses[address] = response;
        delete this._outstanding[address];
    }

    /**
     * @returns The currently outstanding requests.  Do not mutate
     */
    getOutstanding() {
        return this._outstanding;
    }

    addOutstanding(address: string, request: LinearRequest) {
        this._outstanding[address] = request;
    }

    canAdvance(address: string) {
        // Can advance if hasn't failed, already been queued, or responded with no data
        return !this._failures[address]
            && !this._outstanding[address]
            && (!this._responses.hasOwnProperty(address) || Boolean(this._responses[address]?.hiddenData));
    }

    getNonce(address: string) {
        const result = this._noncesByAddress[address];
        if (!result) {
            throw Error("Unable to find nonce for address");
        }
        return result;
    }
}