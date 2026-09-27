const option = { kind: 'some', value: { count: 1 } } as const;
if let Some({ count }) = option { console.log(count); }
