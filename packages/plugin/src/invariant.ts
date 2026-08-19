const PACKAGE_NAME = "@mymeter/dsh-cost-meter";

interface InvariantContext {
  invariants: {
    register(packageName: string, install: () => void): (() => void) | Promise<() => void>;
  };
}

export const name = "mymeter-invariant";
export const inject = ["invariants"] as const;

// MyMeter owns no cross-plugin mutable state beyond its Cordis-scoped services.
const install = (): void => {};

export async function apply(ctx: InvariantContext): Promise<() => void> {
  return await ctx.invariants.register(PACKAGE_NAME, install);
}
