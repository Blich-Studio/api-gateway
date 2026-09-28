import type { FlatConfig } from "@typescript-eslint/utils/ts-eslint";
import prettierConfig from "./prettier.js";
type ConfigInput = FlatConfig.Config | FlatConfig.ConfigArray | undefined;
export declare const sharedConfig: FlatConfig.ConfigArray;
export declare const defineSharedConfig: (...overrides: ConfigInput[]) => FlatConfig.ConfigArray;
export { prettierConfig };
export type { FlatConfig };
export default defineSharedConfig;
