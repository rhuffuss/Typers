// Intentionally rejected: an external string has not crossed numeric validation.
// There is no @ts-expect-error here: the API must actually report TS2322.
export const invalidBudget: number = '1200';
