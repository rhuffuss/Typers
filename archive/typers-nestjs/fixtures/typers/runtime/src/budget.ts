import {Err, fromNullable, None, Ok, type Option, type Result, Some,} from '@typers/core';

export interface QuoteInput {
    readonly units: number;
    readonly unitCents: bigint;
    readonly discountPercent: Option<number>;
}

export type QuoteError =
    | { readonly code: 'INVALID_INPUT'; readonly field: string }
    | {
    readonly code: 'BUDGET_EXCEEDED';
    readonly totalCents: string;
    readonly budgetCents: string;
};

export interface Quote {
    readonly subtotalCents: bigint;
    readonly discountCents: bigint;
    readonly totalCents: bigint;
    readonly discount: 'absent' | 'explicit';
}

function invalid(field: string): Result<never, QuoteError> {
    return Err({code: 'INVALID_INPUT', field});
}

/** Validate an HTTP/JSON boundary before introducing domain types. */
export function parseQuoteInput(
    input: unknown,
): Result<QuoteInput, QuoteError> {
    if (typeof input !== 'object' || input === null || Array.isArray(input))
        return invalid('body');
    if (
        !('units' in input) ||
        typeof input.units !== 'number' ||
        !Number.isSafeInteger(input.units) ||
        input.units < 1
    ) {
        return invalid('units');
    }
    if (
        !('unitCents' in input) ||
        typeof input.unitCents !== 'string' ||
        !/^\d+$/.test(input.unitCents)
    ) {
        return invalid('unitCents');
    }
    const candidate = fromNullable(
        'discountPercent' in input ? input.discountPercent : undefined,
    );
    let discountPercent: Option<number> = None;
    if (candidate.kind === 'some') {
        const discount = candidate.value;
        if (
            typeof discount !== 'number' ||
            !Number.isInteger(discount) ||
            discount < 0 ||
            discount > 100
        ) {
            return invalid('discountPercent');
        }
        discountPercent = Some(discount);
    }
    return Ok({
        units: input.units,
        unitCents: BigInt(input.unitCents),
        discountPercent,
    });
}

/** Currency remains BigInt; percentage discounts round down to whole cents. */
export function createQuote(
    input: unknown,
    budgetCents: bigint,
): Result<Quote, QuoteError> {
    const parsed = parseQuoteInput(input);
    if (parsed.kind === 'err') return parsed;
    const {units, unitCents, discountPercent} = parsed.value;
    const subtotalCents = BigInt(units) * unitCents;
    const discountCents =
        discountPercent.kind === 'some'
            ? (subtotalCents * BigInt(discountPercent.value)) / 100n
            : 0n;
    const totalCents = subtotalCents - discountCents;
    if (totalCents > budgetCents) {
        return Err({
            code: 'BUDGET_EXCEEDED',
            totalCents: totalCents.toString(),
            budgetCents: budgetCents.toString(),
        });
    }
    return Ok({
        subtotalCents,
        discountCents,
        totalCents,
        discount: discountPercent.kind === 'some' ? 'explicit' : 'absent',
    });
}

/** Structural interoperability still needs a boundary check for unknown data. */
export function decodeStock(
    input: unknown,
): Result<Option<number>, QuoteError> {
    if (typeof input !== 'object' || input === null || !('kind' in input))
        return invalid('stock');
    if (input.kind === 'none') return Ok(None);
    if (
        input.kind === 'some' &&
        'value' in input &&
        typeof input.value === 'number' &&
        Number.isSafeInteger(input.value) &&
        input.value >= 0
    ) {
        return Ok(Some(input.value));
    }
    return invalid('stock');
}

/** Result-returning code still propagates unexpected dependency exceptions. */
export function quoteFromProvider(
    provider: () => unknown,
): Result<Quote, QuoteError> {
    return createQuote(provider(), 100_000n);
}

export async function quoteFromAsyncProvider(
    provider: () => Promise<unknown>,
): Promise<Result<Quote, QuoteError>> {
    return createQuote(await provider(), 100_000n);
}
