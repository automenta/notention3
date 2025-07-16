export function memoize<T extends (...args: any[]) => any>(fn: T): T {
	let lastArgs: any[] | null = null;
	let lastResult: ReturnType<T> | null = null;

	return ((...args: any[]) => {
		if (
			lastArgs &&
			args.length === lastArgs.length &&
			args.every((arg, i) => arg === lastArgs![i])
		) {
			return lastResult;
		}

		lastArgs = args;
		lastResult = fn(...args);
		return lastResult;
	}) as T;
}
