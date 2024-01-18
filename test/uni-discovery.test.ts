import { describe, expect, test, it, beforeEach } from '@jest/globals';
import crypto from 'crypto';
import { UniOriginator } from '../src/unidirectional/originator';
import { UniParticipant } from '../src/unidirectional/participant';
import { type UniQuery } from '../src/unidirectional/query';
import { TestNetwork, TestNode, TestLink } from './test-network';
import { MemoryUniOriginatorState } from '../src/unidirectional/memory-originator-state';
import { MemoryUniParticipantState } from '../src/unidirectional/memory-participant-state';
import { UniOriginatorOptions } from '../src/unidirectional/originator-options';
import { UniParticipantOptions } from '../src/unidirectional/participant-options';
import { Plan } from '../src/plan';
import { UniParticipantState } from '../src/unidirectional/participant-state';
import { PrivateLink } from '../src/private-link';
import { AsymmetricImpl, SymmetricImpl } from 'chipcrypt';

let network;
let participantStates: Record<string, UniParticipantState>;
let participants: Record<string, UniParticipant>;
let originator: UniOriginator;

beforeEach(() => {
	// TODO: find a way to mock crypto.randomBytes so that results are deterministic

	/**
	 * @image ../doc/figures/test-network-1.png
	 */
	network = new TestNetwork(
		[
			new TestNode('N1'),
			new TestNode('N2'),
			new TestNode('N3'),
			new TestNode('N4'),
		],
		[
			new TestLink('L1', 'N1', 'N2').withTerms({ balance: 500 }),
			new TestLink('L2', 'N2', 'N3').withTerms({ balance: 500 }),
			new TestLink('L3', 'N2', 'N4').withTerms({ balance: 500 }),
		]
	);

	const originatorNode = network.find('N1');

	function getSendUni(node: TestNode) {
		return async (link: string, plan: Plan, query: UniQuery, hiddenReentrance?: Uint8Array) => {
			const linkNode = network.nodeLinks(node).find(l => l.name === link);
			const participant = participants[linkNode.node2];
			await new Promise(resolve => setTimeout(resolve, 10));
			const result = await participant.query(plan, query, hiddenReentrance);
			await new Promise(resolve => setTimeout(resolve, 10));
			return result;
		};
	}

	const asymmetric = new AsymmetricImpl();
	const originatorOptions = new UniOriginatorOptions(getSendUni(originatorNode), true);
	originatorOptions.stepOptions.maxTime = 100000;	// LONG TIMEOUT FOR DEBUGGING
	const originatorState = new MemoryUniOriginatorState(
		originatorOptions,
		network.nodeLinks(originatorNode).map(l => ({ id: l.name, terms: l.terms } as PrivateLink)),
		{ address: { key: 'N3' } },
		{ balance: 100 },
		asymmetric
	);

	originator = new UniOriginator(originatorState);

	participantStates = network.nodes
		.reduce((c, node) => {
			const participantOptions = new UniParticipantOptions(crypto.randomBytes(32), getSendUni(node), true, []);
			participantOptions.stepOptions.maxTime = 100000;	// LONG TIMEOUT FOR DEBUGGING
			c[node.name] = new MemoryUniParticipantState(
				participantOptions,
				network.nodeLinks(node).map(l => ({ id: l.name, terms: l.terms } as PrivateLink)),
				(linkTerms, queryTerms) =>
					linkTerms['balance'] >= queryTerms['balance']
						? { balance: Math.min(linkTerms['balance'], queryTerms['balance']) }
						: undefined,
				asymmetric,
				network.nodeLinks(node).map(l => ({ address: { key: l.node2 }, linkId: l.name })),
				{ key: node.name }
			);
			return c;
		}, {} as Record<string, UniParticipantState>);
	const symmetric = new SymmetricImpl();

	participants = network.nodes
		.reduce((c, node) => {
			c[node.name] = new UniParticipant(participantStates[node.name], symmetric);
			return c;
		}, {} as Record<string, UniParticipant>);
});

describe('Simple discovery', () => {

	test('should pass the test query through the originator', async () => {
		// TODO: set random seed so that this test is deterministic
		const result = await originator.discover();

		console.log(result);
		// Assert the result
		expect(result.length).toBe(1);
		expect(result[0].path.length).toBe(2);

		// TODO: check results
		//expect(result[0][0].nonce).toBe();
	}, 10000);

	/* TODO: tests for:
		* Finding at different terms.balance levels
		* Multiple simultaneous queries/sessions
		* Not found scenarios
		* Finding at different depths
		* Finding multiple routes
		* Finding based on node identity (not known to peers)
		* Deeper and wider networks
		* Various network timing scenarios
		* Various network failures
		* Bad actor scenarios
	*/
});

