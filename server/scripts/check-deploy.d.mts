export function stripJsonc(text: string): string;
export function checkDeployConfig(jsoncText: string): string[];
export const BILLING_SECRETS: string[];
export function billingOn(jsoncText: string): boolean;
export function missingBillingSecrets(secretListJson: string): string[];
export function deployWarnings(jsoncText: string): string[];
