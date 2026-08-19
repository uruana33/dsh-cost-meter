// packages/plugin/src/invariant.ts
var PACKAGE_NAME = "@mymeter/dsh-cost-meter";
var name = "mymeter-invariant";
var inject = ["invariants"];
var install = () => {
};
async function apply(ctx) {
  return await ctx.invariants.register(PACKAGE_NAME, install);
}
export {
  apply,
  inject,
  name
};
