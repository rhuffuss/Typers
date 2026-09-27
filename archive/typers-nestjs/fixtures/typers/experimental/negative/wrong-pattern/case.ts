const option = { kind: 'ok', value: 1 } as const;
if let Ok(value) = option { console.log(value); }
